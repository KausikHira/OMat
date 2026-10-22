import Link from "next/link";

import type { Facet, Facets, SearchState } from "@/lib/search";
import { buildSearchHref, toggleApplication, toggleElement } from "@/lib/search";

type FacetPanelProps = {
  facets: Facets;
  query: SearchState;
};

type FacetGroupProps = {
  title: string;
  items: Facet[];
  isActive: (value: string) => boolean;
  href: (value: string) => string;
};

function FacetGroup({ title, items, isActive, href }: FacetGroupProps) {
  if (items.length === 0) {
    return null;
  }

  const hasActive = items.some((item) => isActive(item.value));
  const startOpen = items.length <= 12 || hasActive;

  return (
    <details open={startOpen} className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">
        {title}
      </summary>
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => {
          const active = isActive(item.value);

          return (
            <li key={item.value}>
              <Link
                href={href(item.value)}
                aria-current={active ? "true" : undefined}
                className={`flex items-start justify-between gap-3 text-[13px] leading-5 ${
                  active ? "text-accent" : "text-muted hover:text-ink"
                }`}
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    aria-hidden="true"
                    className={`mt-[0.42rem] size-1.5 shrink-0 rounded-full ${
                      active ? "bg-accent" : "bg-transparent"
                    }`}
                  />
                  <span className="min-w-0 text-pretty">{item.label}</span>
                </span>
                <span className="text-[11px] tabular-nums text-muted">{item.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function FacetPanel({ facets, query }: FacetPanelProps) {
  const hasFilters =
    query.elements.length > 0 ||
    query.applications.length > 0 ||
    Boolean(query.property) ||
    Boolean(query.journal);

  return (
    <nav aria-label="Filter measurements" className="space-y-5">
      <FacetGroup
        title="Elements"
        items={facets.elements}
        isActive={(value) => query.elements.includes(value)}
        href={(value) =>
          buildSearchHref({
            ...query,
            elements: toggleElement(query.elements, value),
          })
        }
      />
      <FacetGroup
        title="Application"
        items={facets.applications}
        isActive={(value) => query.applications.includes(value)}
        href={(value) =>
          buildSearchHref({
            ...query,
            applications: toggleApplication(query.applications, value),
          })
        }
      />
      <FacetGroup
        title="Property"
        items={facets.properties}
        isActive={(value) => query.property === value}
        href={(value) =>
          buildSearchHref({
            ...query,
            property: query.property === value ? undefined : value,
          })
        }
      />
      <FacetGroup
        title="Journal"
        items={facets.journals}
        isActive={(value) => query.journal === value}
        href={(value) =>
          buildSearchHref({
            ...query,
            journal: query.journal === value ? undefined : value,
          })
        }
      />
      {hasFilters ? (
        <Link
          href={buildSearchHref({
            ...query,
            elements: [],
            applications: [],
            property: undefined,
            journal: undefined,
          })}
          className="inline-block text-xs text-accent underline-offset-4 hover:underline"
        >
          Clear filters
        </Link>
      ) : null}
    </nav>
  );
}
