import type { Metadata } from "next";
import Link from "next/link";

import { FacetPanel } from "@/components/facet-panel";
import { ChartIcon, ListIcon } from "@/components/icons";
import { PaperRow } from "@/components/paper-row";
import { PlotsView } from "@/components/plots-view";
import { SearchForm } from "@/components/search-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import {
  fetchFacetPanels,
  fetchMeasurements,
  fetchPropsScatterChart,
  prettifySlug,
} from "@/lib/api";
import { type PairOption, pairableProperties } from "@/lib/gsc";
import { groupMeasurementsByPaper, paginatePapers } from "@/lib/papers";
import { NOTEBOOK_DEFAULT_PROPERTIES, NOTEBOOK_DEFAULT_THRESHOLDS } from "@/lib/props-scatter";
import type { SearchState, SortKey } from "@/lib/search";
import { buildSearchHref, parseSearchParams } from "@/lib/search";

export const metadata: Metadata = {
  title: "Search",
};

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PLOT_SLUG_PATTERN = /^[a-z0-9_-]+$/;

function plotSlug(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = Array.isArray(params[key]) ? params[key]?.[0] : params[key];
  return value && PLOT_SLUG_PATTERN.test(value) ? value : undefined;
}

function plotThreshold(
  params: Record<string, string | string[] | undefined>,
  key: string,
): number | undefined {
  const value = Array.isArray(params[key]) ? params[key]?.[0] : params[key];
  const parsed = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(parsed) ? parsed : undefined;
}

type PlotTriple = { a: string; b: string; c: string };

/**
 * Notebook defaults first: with no URL parameters the plot reproduces the
 * plot_3_props_ultimate_with_filtering notebook's active criteria set —
 * glass transition temperature / activation energy / crystallization
 * temperature ringed at 600 K / 2 eV / 800 K. The aggregate endpoint scans
 * the whole corpus (not just the current results page), so the notebook
 * trio is plottable even when the visible page shows other materials; the
 * search-results trio is only a fallback when the notebook trio has no
 * data at all.
 */
function notebookTriple(): PlotTriple {
  const [a, b, c] = NOTEBOOK_DEFAULT_PROPERTIES;
  return { a, b, c };
}

function isNotebookTriple(triple: PlotTriple): boolean {
  const [a, b, c] = NOTEBOOK_DEFAULT_PROPERTIES;
  return triple.a === a && triple.b === b && triple.c === c;
}

function topOptionsTriple(options: PairOption[]): PlotTriple {
  return {
    a: options[0]?.slug ?? "hardness",
    b: options[1]?.slug ?? "density",
    c: options[2]?.slug ?? "youngs_modulus",
  };
}

function resolvePlotTriple(requested: { a?: string; b?: string; c?: string }): PlotTriple {
  const a = requested.a ?? NOTEBOOK_DEFAULT_PROPERTIES[0];
  const b = requested.b ?? NOTEBOOK_DEFAULT_PROPERTIES[1];
  const c = requested.c ?? NOTEBOOK_DEFAULT_PROPERTIES[2];
  if (new Set([a, b, c]).size === 3) {
    return { a, b, c };
  }
  return notebookTriple();
}

/**
 * The property selects must list whatever is plotted. The notebook trio is
 * plottable corpus-wide, so it is merged into the result-page-derived
 * options even when the current page's materials don't measure it.
 */
function withNotebookOptions(options: PairOption[]): PairOption[] {
  const bySlug = new Map(options.map((option) => [option.slug, option]));
  for (const slug of NOTEBOOK_DEFAULT_PROPERTIES) {
    if (!bySlug.has(slug)) {
      bySlug.set(slug, { slug, label: prettifySlug(slug), count: 0 });
    }
  }
  return [...bySlug.values()];
}

/**
 * Criteria are all-or-nothing (the notebook's criteria sets always specify
 * all three thresholds); partial input is ignored. The notebook's criteria-8
 * values apply automatically when the notebook triple is selected.
 */
function resolveThresholds(
  requested: { a?: number; b?: number; c?: number },
  triple: PlotTriple,
): [number, number, number] | null {
  if (requested.a !== undefined && requested.b !== undefined && requested.c !== undefined) {
    return [requested.a, requested.b, requested.c];
  }
  return isNotebookTriple(triple) ? NOTEBOOK_DEFAULT_THRESHOLDS : null;
}

const resultTabs = [
  { key: "all", label: "All", Icon: ListIcon },
  { key: "plots", label: "Plots", Icon: ChartIcon },
] as const;

type PaginationProps = {
  query: SearchState;
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
};

function Pagination({ query, page, totalPages, start, end, total }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-[12px]"
    >
      <p className="text-muted">
        Showing {start}–{end} of {total} papers
      </p>
      <div className="flex items-center gap-4">
        {page > 1 ? (
          <Link
            href={buildSearchHref({ ...query, page: page - 1 })}
            rel="prev"
            className="text-accent underline underline-offset-4 hover:text-ink"
          >
            ← Previous
          </Link>
        ) : (
          <span className="text-muted/50">← Previous</span>
        )}
        <span className="tabular-nums text-muted">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={buildSearchHref({ ...query, page: page + 1 })}
            rel="next"
            className="text-accent underline underline-offset-4 hover:text-ink"
          >
            Next →
          </Link>
        ) : (
          <span className="text-muted/50">Next →</span>
        )}
      </div>
    </nav>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const rawParams = await searchParams;
  const query: SearchState = parseSearchParams(rawParams);
  const requestedTriple = {
    a: plotSlug(rawParams, "propX"),
    b: plotSlug(rawParams, "propY"),
    c: plotSlug(rawParams, "propZ"),
  };
  const requestedThresholds = {
    a: plotThreshold(rawParams, "thX"),
    b: plotThreshold(rawParams, "thY"),
    c: plotThreshold(rawParams, "thZ"),
  };

  // The search endpoint is measurement-level. Group its page of records into
  // papers for display; paper-level pagination can move server-side when the
  // API exposes grouped paper results.
  const [{ measurements: results }, facetPanels] = await Promise.all([
    fetchMeasurements(query),
    fetchFacetPanels(query),
  ]);
  const rawOptions = pairableProperties(results);
  const plotOptions = withNotebookOptions(rawOptions);
  const explicitTriple = Boolean(requestedTriple.a || requestedTriple.b || requestedTriple.c);
  const plotTriple = resolvePlotTriple(requestedTriple);
  const plotThresholds = resolveThresholds(requestedThresholds, plotTriple);
  // The three-property scatter is only fetched on the Plots tab, from the
  // aggregate endpoint (never from the raw result set in the browser).
  let propsScatter =
    query.tab === "plots" ? await fetchPropsScatterChart(query, plotTriple, plotThresholds) : null;
  // Notebook trio with no data on this corpus (rare): fall back to the
  // search's own most-measured properties rather than an empty frame.
  let effectiveTriple = plotTriple;
  let effectiveThresholds = plotThresholds;
  if (propsScatter && propsScatter.chart.counts.merged === 0 && !explicitTriple) {
    effectiveTriple = topOptionsTriple(rawOptions);
    effectiveThresholds = resolveThresholds(requestedThresholds, effectiveTriple);
    propsScatter = await fetchPropsScatterChart(query, effectiveTriple, effectiveThresholds);
  }
  const papers = groupMeasurementsByPaper(results);
  const paperPage = paginatePapers(papers, query.page);
  const facets = facetPanels.facets;
  const hasFacets =
    facets.elements.length > 0 ||
    facets.applications.length > 0 ||
    facets.properties.length > 0 ||
    facets.journals.length > 0;
  const hasFilters =
    query.elements.length > 0 ||
    query.applications.length > 0 ||
    Boolean(query.property) ||
    Boolean(query.journal);
  const hasResults = results.length > 0;

  const sorts: { key: SortKey; label: string }[] = query.property
    ? [
        { key: "relevance", label: "Relevance" },
        { key: "newest", label: "Newest" },
        { key: "value", label: "Highest value" },
      ]
    : [
        { key: "relevance", label: "Relevance" },
        { key: "newest", label: "Newest" },
      ];

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-line">
        <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:px-10 xl:px-14">
          <Wordmark />
          <div className="order-3 w-full min-w-0 sm:order-none sm:w-auto sm:max-w-3xl sm:flex-1">
            <SearchForm
              compact
              defaultValue={query.q}
              preserve={{
                elements: query.elements,
                applications: query.applications,
                property: query.property,
                journal: query.journal,
                sort: query.sort,
                tab: query.tab,
              }}
            />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full flex-1 px-4 py-7 sm:px-6 lg:px-10 xl:px-14">
        <nav aria-label="Result views" className="flex gap-7 border-b border-line">
          {resultTabs.map(({ key, label, Icon }) => {
            const active = query.tab === key;

            return (
              <Link
                key={key}
                href={buildSearchHref({ ...query, tab: key, page: 1 })}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-[13px] transition-colors ${
                  active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <Icon className={`size-4 ${active ? "text-accent" : ""}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div
          className={`mt-7 grid gap-10 ${
            hasFacets
              ? "lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-14"
              : ""
          }`}
        >
          {hasFacets ? (
            <aside className="hidden lg:block">
              <FacetPanel facets={facets} query={query} />
            </aside>
          ) : null}

          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[13px] text-muted">
                <span className="font-medium text-ink">{papers.length}</span>{" "}
                {papers.length === 1 ? "paper" : "papers"}
                {query.q ? (
                  <>
                    {" "}
                    for <span className="text-ink">“{query.q}”</span>
                  </>
                ) : null}
              </p>

              {hasResults && query.tab === "all" ? (
                <nav aria-label="Sort results" className="flex items-center gap-4 text-[12px]">
                  {sorts.map((option) => {
                    const active = query.sort === option.key;

                    return (
                      <Link
                        key={option.key}
                        href={buildSearchHref({ ...query, sort: option.key, page: 1 })}
                        aria-current={active ? "true" : undefined}
                        className={
                          active
                            ? "text-ink underline decoration-accent decoration-2 underline-offset-4"
                            : "text-muted hover:text-ink"
                        }
                      >
                        {option.label}
                      </Link>
                    );
                  })}
                </nav>
              ) : null}

              {hasResults && query.tab === "plots" ? (
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted">Aggregate view</p>
              ) : null}
            </div>

            {hasFacets ? (
              <details className="mt-5 border-y border-line py-3 lg:hidden">
                <summary className="cursor-pointer text-[13px] font-medium">
                  Filters{hasFilters ? " (active)" : ""}
                </summary>
                <div className="mt-4">
                  <FacetPanel facets={facets} query={query} />
                </div>
              </details>
            ) : null}

            {query.tab === "plots" && propsScatter ? (
              <PlotsView
                papers={papers}
                propsScatter={{
                  query,
                  triple: effectiveTriple,
                  thresholds: effectiveThresholds,
                  options: plotOptions,
                  chart: propsScatter.chart,
                }}
              />
            ) : query.tab === "all" ? (
              hasResults ? (
                <>
                  <ol className="mt-2 list-none">
                    {paperPage.items.map((paper) => (
                      <PaperRow key={paper.key} paper={paper} />
                    ))}
                  </ol>
                  <Pagination
                    query={query}
                    page={paperPage.page}
                    totalPages={paperPage.totalPages}
                    start={paperPage.start}
                    end={paperPage.end}
                    total={papers.length}
                  />
                </>
              ) : (
                <div className="py-16">
                  <h2 className="font-display text-2xl tracking-[-0.01em]">No papers found</h2>
                  <p className="mt-3 max-w-md text-[13px] leading-6 text-muted">
                    {hasFilters
                      ? "Try a composition label such as TiAlCrN, an element symbol, or remove a filter."
                      : "Try a composition label such as TiAlCrN, an element symbol, or a property such as band gap."}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-5 text-[13px]">
                    {hasFilters ? (
                      <Link
                        href={buildSearchHref({
                          ...query,
                          elements: [],
                          applications: [],
                          property: undefined,
                          journal: undefined,
                          page: 1,
                        })}
                        className="text-accent underline underline-offset-4"
                      >
                        Clear filters
                      </Link>
                    ) : null}
                    <Link
                      href="/"
                      className="text-muted underline underline-offset-4 hover:text-ink"
                    >
                      Start a new search
                    </Link>
                  </div>
                </div>
              )
            ) : null}
          </section>
        </div>
      </main>

      <footer className="flex w-full items-center justify-between gap-6 border-t border-line px-4 py-6 text-[11px] text-muted sm:px-6 lg:px-10 xl:px-14">
        <span>
          {facetPanels.source === "api" ? "Live API." : "API unreachable — showing mock records."}
        </span>
        <a
          href="https://github.com/Jayesh-Dev21/Omat-se"
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 transition-colors hover:text-ink hover:underline underline-offset-4"
        >
          OMAT-SE
        </a>
      </footer>
    </div>
  );
}
