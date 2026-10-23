// Adapter: API records/facets -> the shapes the web components render.
//
// The API is the source of truth (packages/api-client). Mock records remain
// only as a dev fallback when the API is unreachable, so the UI works with or
// without OpenSearch running.

import type { ApiFacetBucket, ApiRecord } from "@omat/api-client";
import {
  type FacetsResponse,
  type SearchParams,
  fetchFacets,
  fetchPropsScatter,
  searchRecords,
} from "@omat/api-client";

import type { GscAxis } from "@/lib/gsc";
import { MEASUREMENTS, type Measurement } from "@/lib/mock-records";
import { type PropsPoint, type PropsScatterChart, buildPropsScatter } from "@/lib/props-scatter";
import { type Facets, type SearchState, getFacets, searchMeasurements } from "@/lib/search";

// ---- Sort mapping: web keys -> API keys --------------------------------------

const SORT_MAP: Record<string, string> = {
  relevance: "relevance",
  newest: "year_desc",
  value: "value_desc",
};

export type SearchResult = {
  measurements: Measurement[];
  total: number;
  tookMs: number;
  source: "api" | "mock";
};

export function prettifySlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word) =>
      word.length <= 1 ? word.toUpperCase() : `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`,
    )
    .join(" ");
}

export function toMeasurement(record: ApiRecord): Measurement {
  const amounts = (record.composition?.elements ?? []).map((entry) => ({
    symbol: entry.symbol ?? "",
    value: entry.at_pct ?? 0,
    // API stores at%; the UI labels it "mol%" which matches the source unit.
    unit: "mol" as const,
  }));
  return {
    id: record.record_id ?? "",
    pii: record.article_pii ?? "",
    doi: record.doi ?? "",
    journal: record.journal?.name ?? "",
    journalSlug: record.journal?.slug ?? "",
    year: record.year ?? 0,
    // Table No. is not in the source data; the row degrades gracefully.
    table: undefined,
    composition: record.composition?.canonical ?? record.composition?.label ?? "",
    elements: record.elements ?? [],
    amounts,
    property: {
      name: record.property?.name ?? "",
      slug: record.property?.slug ?? "",
      value: record.property?.value ?? 0,
      unit: record.property?.unit ?? "",
    },
    applications: (record.applications ?? []).map((application) => ({
      label: application.raw ?? prettifySlug(application.slug ?? ""),
      slug: application.slug ?? "",
    })),
    title: record.title,
    abstract: record.abstract,
  };
}

function bucketsToFacets(buckets: ApiFacetBucket[]) {
  return buckets.map((bucket) => ({
    value: bucket.value,
    label: prettifySlug(bucket.value),
    count: bucket.count,
  }));
}

export function toFacets(response: FacetsResponse): Facets {
  return {
    elements: bucketsToFacets(response.elements ?? []),
    properties: bucketsToFacets(response.property ?? []),
    journals: bucketsToFacets(response.journal ?? []),
    applications: bucketsToFacets(response.application ?? []),
  };
}

function toApiParams(state: SearchState): SearchParams {
  return {
    q: state.q,
    elements: state.elements,
    property: state.property,
    journal: state.journal ? [state.journal] : undefined,
    app: state.applications,
    sort: SORT_MAP[state.sort] ?? "relevance",
  };
}

export async function fetchMeasurements(state: SearchState, limit = 100): Promise<SearchResult> {
  try {
    const search = await searchRecords({ ...toApiParams(state), limit });
    const measurements = (search.data ?? []).map(toMeasurement);
    return {
      measurements,
      total: search.total ?? measurements.length,
      tookMs: search.took_ms ?? 0,
      source: "api",
    };
  } catch (error) {
    // Dev fallback: no OpenSearch/API running. Log once, keep the UI usable.
    console.warn("[omat] api unreachable, using mock records:", String(error));
    const measurements = searchMeasurements(MEASUREMENTS, state).slice(0, limit);
    return {
      measurements,
      total: measurements.length,
      tookMs: 0,
      source: "mock",
    };
  }
}

export async function fetchFacetPanels(
  state: SearchState,
): Promise<{ facets: Facets; source: "api" | "mock" }> {
  try {
    // Counts exclude the facet's own field so picking a property does not
    // hide the other properties from the rail (same rule as the mock path).
    const response = await fetchFacets({
      q: state.q,
      property: state.property,
      journal: state.journal ? [state.journal] : undefined,
      app: state.applications,
      elements: [],
    });
    return { facets: toFacets(response), source: "api" };
  } catch {
    const facets = getFacets(searchMeasurements(MEASUREMENTS, state));
    return { facets, source: "mock" };
  }
}

// ---- Props scatter chart: API aggregate -> web chart shape ---------------------

function toAxis(
  axis: { slug?: string; name?: string; unit?: string } | null | undefined,
  fallbackSlug: string,
): GscAxis {
  return {
    slug: axis?.slug ?? fallbackSlug,
    name: axis?.name ?? fallbackSlug,
    unit: axis?.unit ?? "",
  };
}

export async function fetchPropsScatterChart(
  state: SearchState,
  triple: { a: string; b: string; c: string },
  thresholds: [number, number, number] | null,
): Promise<{ chart: PropsScatterChart; source: "api" | "mock" }> {
  const params = {
    property_a: triple.a,
    property_b: triple.b,
    property_c: triple.c,
    ...(thresholds
      ? { threshold_a: thresholds[0], threshold_b: thresholds[1], threshold_c: thresholds[2] }
      : {}),
    elements: state.elements,
    journal: state.journal ? [state.journal] : undefined,
    app: state.applications,
  };

  try {
    const response = await fetchPropsScatter(params);
    // The API sends [x, y, z, flag] tuples; the chart consumes objects.
    const points: PropsPoint[] = (response.points ?? []).map((tuple) => ({
      x: tuple[0] ?? 0,
      y: tuple[1] ?? 0,
      z: tuple[2] ?? 0,
      highlighted: (tuple[3] ?? 0) === 1,
    }));
    const bounds = response.bounds ?? { a: [0, 0], b: [0, 0], c: [0, 0] };
    return {
      chart: {
        propertyA: toAxis(response.property_a, triple.a),
        propertyB: toAxis(response.property_b, triple.b),
        propertyC: toAxis(response.property_c, triple.c),
        thresholds: response.thresholds
          ? [response.thresholds[0] ?? 0, response.thresholds[1] ?? 0, response.thresholds[2] ?? 0]
          : null,
        points,
        bounds: {
          a: [bounds.a[0] ?? 0, bounds.a[1] ?? 0],
          b: [bounds.b[0] ?? 0, bounds.b[1] ?? 0],
          c: [bounds.c[0] ?? 0, bounds.c[1] ?? 0],
        },
        counts: response.counts ?? { merged: 0, plotted: 0, highlighted: 0 },
      },
      source: "api",
    };
  } catch {
    // Dev fallback: same chart math over the mock records.
    const chart = buildPropsScatter(
      searchMeasurements(MEASUREMENTS, state),
      triple.a,
      triple.b,
      triple.c,
      thresholds,
    );
    return { chart, source: "mock" };
  }
}
