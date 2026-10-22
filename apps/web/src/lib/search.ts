import type { Measurement } from "./mock-records";

export type SortKey = "relevance" | "newest" | "value";
export type ResultTab = "all" | "plots";

export type SearchState = {
  q: string;
  elements: string[];
  applications: string[];
  property?: string;
  journal?: string;
  sort: SortKey;
  tab: ResultTab;
  page: number;
};

export type Facet = {
  value: string;
  label: string;
  count: number;
};

export type Facets = {
  elements: Facet[];
  applications: Facet[];
  properties: Facet[];
  journals: Facet[];
};

type SearchParamValue = string | string[] | undefined;

const valueFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function first(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function all(value: SearchParamValue): string[] {
  if (!value) {
    return [];
  }
  return Array.from(new Set(Array.isArray(value) ? value : [value]));
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactFormula(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, "");
}

function scoreRecord(
  record: Measurement,
  tokens: string[],
  normalizedQuery: string,
  compactQuery: string,
): number {
  const composition = normalize(record.composition);
  const compactComposition = compactFormula(record.composition);
  const propertyName = normalize(record.property.name);
  const applicationLabels = normalize(
    record.applications.map((application) => application.label).join(" "),
  );
  const journal = normalize(record.journal);
  const doi = record.doi.toLowerCase();

  let score = 0;

  if (compactQuery.length >= 3 && compactComposition.includes(compactQuery)) {
    score += 10;
  }
  if (composition === normalizedQuery) {
    score += 6;
  }
  if (propertyName === normalizedQuery) {
    score += 6;
  }
  if (applicationLabels === normalizedQuery) {
    score += 4;
  }

  for (const token of tokens) {
    if (compactComposition.includes(token)) {
      score += 2;
    }
    if (record.elements.some((element) => element.toLowerCase() === token)) {
      score += 3;
    }
    if (propertyName.includes(token)) {
      score += 2;
    }
    if (applicationLabels.includes(token)) {
      score += 2;
    }
    if (journal.includes(token)) {
      score += 1;
    }
    if (doi.includes(token)) {
      score += 1;
    }
  }

  return score;
}

export function parseSearchParams(params: Record<string, SearchParamValue>): SearchState {
  const property = first(params.property) || undefined;
  const sort = first(params.sort);
  const normalizedSort: SortKey =
    sort === "newest" ? "newest" : sort === "value" && property ? "value" : "relevance";
  const rawPage = Number.parseInt(first(params.page) ?? "", 10);

  return {
    q: (first(params.q) ?? "").trim(),
    elements: all(params.element),
    applications: all(params.application),
    property,
    journal: first(params.journal) || undefined,
    sort: normalizedSort,
    tab: first(params.tab) === "plots" ? "plots" : "all",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function searchMeasurements(measurements: Measurement[], state: SearchState): Measurement[] {
  const normalizedQuery = normalize(state.q);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const compactQuery = compactFormula(state.q);

  const scored = measurements
    .map((record) => ({
      record,
      score: tokens.length === 0 ? 0 : scoreRecord(record, tokens, normalizedQuery, compactQuery),
    }))
    .filter(({ score }) => tokens.length === 0 || score > 0)
    .filter(({ record }) => {
      if (state.elements.length > 0) {
        const elements = new Set(record.elements);
        if (!state.elements.every((element) => elements.has(element))) {
          return false;
        }
      }
      if (state.property && record.property.slug !== state.property) {
        return false;
      }
      if (state.applications.length > 0) {
        const applications = new Set(record.applications.map((application) => application.slug));
        if (!state.applications.some((application) => applications.has(application))) {
          return false;
        }
      }
      if (state.journal && record.journalSlug !== state.journal) {
        return false;
      }
      return true;
    });

  if (state.sort === "newest") {
    scored.sort((a, b) => b.record.year - a.record.year || b.score - a.score);
  } else if (state.sort === "value") {
    scored.sort(
      (a, b) => b.record.property.value - a.record.property.value || b.record.year - a.record.year,
    );
  } else {
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        b.record.year - a.record.year ||
        a.record.composition.localeCompare(b.record.composition),
    );
  }

  return scored.map(({ record }) => record);
}

function sortFacets(facets: Facet[]): Facet[] {
  return facets.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function getFacets(measurements: Measurement[]): Facets {
  const elementCounts = new Map<string, number>();
  const applicationCounts = new Map<string, { label: string; count: number }>();
  const propertyCounts = new Map<string, { label: string; count: number }>();
  const journalCounts = new Map<string, { label: string; count: number }>();

  for (const record of measurements) {
    for (const element of record.elements) {
      elementCounts.set(element, (elementCounts.get(element) ?? 0) + 1);
    }

    for (const application of record.applications) {
      const entry = applicationCounts.get(application.slug) ?? {
        label: application.label,
        count: 0,
      };
      entry.count += 1;
      applicationCounts.set(application.slug, entry);
    }

    const property = propertyCounts.get(record.property.slug) ?? {
      label: record.property.name,
      count: 0,
    };
    property.count += 1;
    propertyCounts.set(record.property.slug, property);

    const journal = journalCounts.get(record.journalSlug) ?? {
      label: record.journal,
      count: 0,
    };
    journal.count += 1;
    journalCounts.set(record.journalSlug, journal);
  }

  const elements = sortFacets(
    Array.from(elementCounts, ([value, count]) => ({ value, label: value, count })),
  );
  const applications = sortFacets(
    Array.from(applicationCounts, ([value, { label, count }]) => ({ value, label, count })),
  );
  const properties = sortFacets(
    Array.from(propertyCounts, ([value, { label, count }]) => ({ value, label, count })),
  );
  const journals = sortFacets(
    Array.from(journalCounts, ([value, { label, count }]) => ({ value, label, count })),
  );

  return { elements, applications, properties, journals };
}

export function buildSearchHref(state: SearchState): string {
  const params = new URLSearchParams();

  if (state.q.trim()) {
    params.set("q", state.q.trim());
  }
  for (const element of [...state.elements].sort()) {
    params.append("element", element);
  }
  for (const application of [...state.applications].sort()) {
    params.append("application", application);
  }
  if (state.property) {
    params.set("property", state.property);
  }
  if (state.journal) {
    params.set("journal", state.journal);
  }
  if (state.sort !== "relevance") {
    params.set("sort", state.sort);
  }
  if (state.tab === "plots") {
    params.set("tab", "plots");
  }
  if (state.page > 1) {
    params.set("page", String(state.page));
  }

  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
}

export function toggleElement(elements: string[], symbol: string): string[] {
  return elements.includes(symbol)
    ? elements.filter((element) => element !== symbol)
    : [...elements, symbol];
}

export function toggleApplication(applications: string[], slug: string): string[] {
  return applications.includes(slug)
    ? applications.filter((application) => application !== slug)
    : [...applications, slug];
}

export function formatValue(value: number): string {
  return valueFormatter.format(value);
}
