// Typed client for the OMAT-SE FastAPI backend.
//
// Generated OpenAPI types land in ./schema.d.ts after `bun run gen:api`
// (requires the API on localhost:8000). Until then the hand-written shapes
// below mirror apps/api/src/omat_api/service.py exactly.
//
// Base URL resolution: OMAT_API_URL (server) > NEXT_PUBLIC_API_URL (client)
// > http://localhost:8000.

export const apiClientVersion = "v1";

export function apiBaseUrl(): string {
  const fromEnv =
    (typeof process !== "undefined" &&
      (process.env?.OMAT_API_URL || process.env?.NEXT_PUBLIC_API_URL)) ||
    undefined;
  return fromEnv?.replace(/\/$/, "") || "http://localhost:8000";
}

// ---- Response shapes (mirrors omat_api.service) ----------------------------

export type ApiJournal = { name?: string; slug?: string } | null;

export type ApiRecord = {
  record_id?: string;
  article_pii?: string;
  doi?: string;
  paper_link?: string;
  has_composition?: boolean;
  has_property?: boolean;
  composition?: {
    canonical?: string;
    label?: string;
    elements?: { symbol?: string; at_pct?: number }[];
  } | null;
  property?: {
    name?: string;
    slug?: string;
    value?: number;
    unit?: string | null;
    value_si?: number | null;
  } | null;
  elements?: string[];
  species?: string[];
  journal?: ApiJournal;
  year?: number | null;
  applications?: { raw?: string; slug?: string }[];
  // Enrichment fields; declared in the index mapping and optional until the
  // enrichment pipeline has populated them.
  title?: string;
  abstract?: string;
};

export type SearchResponse = {
  data?: ApiRecord[];
  total?: number;
  took_ms?: number;
  cursor?: string | null;
};

export type ApiFacetBucket = { value: string; count: number };

export type FacetsResponse = {
  elements?: ApiFacetBucket[];
  property?: ApiFacetBucket[];
  journal?: ApiFacetBucket[];
  application?: ApiFacetBucket[];
  property_stats?: Record<string, unknown>;
};

// ---- GSC (glass-structure-composition) chart ----------------------------------

// The API serializes each point as a bare [x, y] tuple (omat_core.gsc
// emits lists, not objects), so the client type must match the wire format.
// The web adapter converts tuples to the {x, y} shape its chart code uses.
export type GscPoint = [number, number];

export type GscAxis = { slug?: string; name?: string; unit?: string };

export type GscFamily = {
  family?: string;
  count?: number;
  points?: GscPoint[];
  /** Smoothed, closed convex hull polygon in the same units as the axes. */
  hull?: GscPoint[];
};

export type GscResponse = {
  kind?: "gsc";
  property_a?: GscAxis;
  property_b?: GscAxis;
  families?: GscFamily[];
  total_points?: number;
};

export type GscParams = {
  property_a: string;
  property_b: string;
  elements?: string[];
  journal?: string[];
  app?: string[];
};

export function fetchGsc(params: GscParams, signal?: AbortSignal): Promise<GscResponse> {
  const search = new URLSearchParams({
    kind: "gsc",
    property_a: params.property_a,
    property_b: params.property_b,
  });
  for (const element of params.elements ?? []) search.append("elements", element);
  for (const journal of params.journal ?? []) search.append("journal", journal);
  for (const app of params.app ?? []) search.append("app", app);
  return getJson<GscResponse>(`/v1/aggregates?${search.toString()}`, signal);
}

// ---- props_scatter (three-property notebook chart) ----------------------------

// Each point is a bare [x, y, z, highlighted] tuple on the wire (py-core
// emits lists, not objects); the web adapter converts to objects.
export type PropsScatterPoint = [number, number, number, number];

export type PropsScatterResponse = {
  kind?: "props_scatter";
  property_a?: GscAxis;
  property_b?: GscAxis;
  property_c?: GscAxis;
  thresholds?: number[] | null;
  points?: PropsScatterPoint[];
  bounds?: { a: [number, number]; b: [number, number]; c: [number, number] };
  counts?: { merged: number; plotted: number; highlighted: number };
};

export type PropsScatterParams = {
  property_a: string;
  property_b: string;
  property_c: string;
  threshold_a?: number;
  threshold_b?: number;
  threshold_c?: number;
  elements?: string[];
  journal?: string[];
  app?: string[];
};

export function fetchPropsScatter(
  params: PropsScatterParams,
  signal?: AbortSignal,
): Promise<PropsScatterResponse> {
  const search = new URLSearchParams({
    kind: "props_scatter",
    property_a: params.property_a,
    property_b: params.property_b,
    property_c: params.property_c,
  });
  if (params.threshold_a !== undefined) search.set("threshold_a", String(params.threshold_a));
  if (params.threshold_b !== undefined) search.set("threshold_b", String(params.threshold_b));
  if (params.threshold_c !== undefined) search.set("threshold_c", String(params.threshold_c));
  for (const element of params.elements ?? []) search.append("elements", element);
  for (const journal of params.journal ?? []) search.append("journal", journal);
  for (const app of params.app ?? []) search.append("app", app);
  return getJson<PropsScatterResponse>(`/v1/aggregates?${search.toString()}`, signal);
}

// ---- Query params -----------------------------------------------------------

export type SearchParams = {
  q?: string;
  elements?: string[];
  property?: string;
  min?: number;
  max?: number;
  journal?: string[];
  app?: string[];
  year_from?: number;
  year_to?: number;
  sort?: string; // relevance | year_desc | year_asc | value_asc | value_desc
  cursor?: string;
  limit?: number;
};

export function buildSearchQuery(params: SearchParams): string {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  for (const element of params.elements ?? []) search.append("elements", element);
  for (const journal of params.journal ?? []) search.append("journal", journal);
  for (const app of params.app ?? []) search.append("app", app);
  if (params.property) search.set("property", params.property);
  if (params.min !== undefined) search.set("min", String(params.min));
  if (params.max !== undefined) search.set("max", String(params.max));
  if (params.year_from !== undefined) search.set("year_from", String(params.year_from));
  if (params.year_to !== undefined) search.set("year_to", String(params.year_to));
  if (params.sort) search.set("sort", params.sort);
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  return search.toString();
}

// ---- Endpoints ---------------------------------------------------------------

/**
 * Default request timeout. Without it a wedged API worker stalls SSR for as
 * long as the socket lives (observed: 155s pages while the API reloaded a
 * broken router); with it the caller falls back to mock data after 10s.
 */
const REQUEST_TIMEOUT_MS = 10_000;

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    // Next.js SSR fetch caches aggressively; API responses must stay fresh.
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`api ${path} failed: http ${response.status}`);
  }
  return (await response.json()) as T;
}

export function searchRecords(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const query = buildSearchQuery(params);
  return getJson<SearchResponse>(`/v1/search?${query}`, signal);
}

export function fetchFacets(
  params: Omit<SearchParams, "cursor" | "limit">,
  signal?: AbortSignal,
): Promise<FacetsResponse> {
  const query = buildSearchQuery({ ...params, limit: undefined });
  return getJson<FacetsResponse>(`/v1/facets?${query}`, signal);
}

export function fetchPaper(
  idOrDoi: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  return getJson<Record<string, unknown>>(
    `/v1/papers/${encodeURIComponent(idOrDoi)}`,
    signal,
  );
}

// ---- Per-paper chat (SSE) ------------------------------------------------------

export type ChatEvent =
  | { type: "meta"; paper: string; records: number }
  | { type: "delta"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

/**
 * Stream a chat reply for one paper. The API answers over SSE with
 * `data: {"delta": "..."}` chunks terminated by `[DONE]`; any error event is
 * surfaced as a thrown Error so the UI can fall back to the offline replies.
 */
export async function streamPaperChat(
  idOrDoi: string,
  message: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl()}/v1/papers/${encodeURIComponent(idOrDoi)}/chat`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
      signal,
    },
  );
  if (!response.ok || !response.body) {
    throw new Error(`chat failed: http ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const emit = (raw: string): void => {
    if (raw === "[DONE]") {
      return;
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Non-JSON SSE line; ignore so a stray keepalive cannot break the stream.
      return;
    }
    if (typeof payload.error === "string") {
      throw new Error(payload.error);
    }
    if (typeof payload.delta === "string") {
      onDelta(payload.delta);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        emit(trimmed.slice(5).trim());
      }
    }
  }
  if (buffer.startsWith("data:")) {
    emit(buffer.slice(5).trim());
  }
}