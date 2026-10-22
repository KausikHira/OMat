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

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    signal,
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