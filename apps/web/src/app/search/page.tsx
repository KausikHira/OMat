import type { Metadata } from "next";
import Link from "next/link";

import { FacetPanel } from "@/components/facet-panel";
import { ResultRow } from "@/components/result-row";
import { SearchForm } from "@/components/search-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { fetchFacetPanels, fetchMeasurements } from "@/lib/api";
import type { SearchState, SortKey } from "@/lib/search";
import { buildSearchHref, parseSearchParams } from "@/lib/search";

export const metadata: Metadata = {
  title: "Search",
};

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query: SearchState = parseSearchParams(await searchParams);

  // Live API first; mock records only when the API is unreachable.
  const [{ measurements: results, total }, facetPanels] = await Promise.all([
    fetchMeasurements(query),
    fetchFacetPanels(query),
  ]);
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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
          <Wordmark />
          <div className="order-3 w-full min-w-0 sm:order-none sm:w-auto sm:max-w-2xl sm:flex-1">
            <SearchForm
              compact
              defaultValue={query.q}
              preserve={{
                elements: query.elements,
                applications: query.applications,
                property: query.property,
                journal: query.journal,
                sort: query.sort,
              }}
            />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8">
        <div
          className={`grid gap-10 ${
            hasFacets ? "lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-14" : ""
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
                <span className="font-medium text-ink">{total}</span>{" "}
                {total === 1 ? "measurement" : "measurements"}
                {query.q ? (
                  <>
                    {" "}
                    for <span className="text-ink">“{query.q}”</span>
                  </>
                ) : null}
              </p>

              {results.length > 0 ? (
                <nav aria-label="Sort results" className="flex items-center gap-4 text-[12px]">
                  {sorts.map((option) => {
                    const active = query.sort === option.key;

                    return (
                      <Link
                        key={option.key}
                        href={buildSearchHref({ ...query, sort: option.key })}
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

            {results.length > 0 ? (
              <ol className="mt-2 list-none">
                {results.map((record) => (
                  <ResultRow key={record.id} record={record} />
                ))}
              </ol>
            ) : (
              <div className="py-16">
                <h2 className="font-display text-2xl tracking-[-0.01em]">No measurements found</h2>
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
                      })}
                      className="text-accent underline underline-offset-4"
                    >
                      Clear filters
                    </Link>
                  ) : null}
                  <Link href="/" className="text-muted underline underline-offset-4 hover:text-ink">
                    Start a new search
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 border-t border-line px-5 py-6 text-[11px] text-muted sm:px-8">
        <span>
          {facetPanels.source === "api" ? "Live API." : "API unreachable — showing mock records."}
        </span>
        <span className="shrink-0">OMAT-SE</span>
      </footer>
    </div>
  );
}
