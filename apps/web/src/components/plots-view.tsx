import type { ReactNode } from "react";

import type { PaperGroup } from "@/lib/papers";
import {
  type SeriesPoint,
  type YearPoint,
  getMeasurementsByProperty,
  getPapersByJournal,
  getPapersByYear,
} from "@/lib/plots";

type ChartFrameProps = {
  title: string;
  caption: string;
  children: ReactNode;
};

function ChartFrame({ title, caption, children }: ChartFrameProps) {
  return (
    <figure className="border border-line bg-panel/45 p-5 sm:p-6">
      <figcaption>
        <h3 className="font-display text-[1.35rem] leading-tight tracking-[-0.01em]">{title}</h3>
        <p className="mt-1 text-[11px] leading-5 text-muted">{caption}</p>
      </figcaption>
      {children}
    </figure>
  );
}

function YearChart({ points }: { points: YearPoint[] }) {
  if (points.length === 0) {
    return (
      <ChartFrame title="Papers by year" caption="Publication years for the matching papers.">
        <p className="mt-5 text-[12px] text-muted">No publication years available.</p>
      </ChartFrame>
    );
  }

  const maxCount = Math.max(1, ...points.map((point) => point.count));
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const firstYear = points[0]?.year;
  const lastYear = points[points.length - 1]?.year;
  const span = firstYear === lastYear ? String(firstYear) : `${firstYear}–${lastYear}`;

  return (
    <ChartFrame title="Papers by year" caption={`${total} papers, ${span}.`}>
      <ol className="mt-7 flex h-44 items-end gap-1.5" aria-label="Papers by publication year">
        {points.map((point) => {
          const height = point.count > 0 ? Math.max(4, (point.count / maxCount) * 100) : 2;
          return (
            <li
              key={point.year}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="text-[10px] tabular-nums text-muted">{point.count || ""}</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-[2px] ${
                    point.count > 0 ? "bg-accent" : "bg-line-strong"
                  }`}
                  style={{ height: `${height}%` }}
                  title={`${point.year}: ${point.count} paper${point.count === 1 ? "" : "s"}`}
                />
              </div>
              <span className="text-[9px] tabular-nums text-muted sm:text-[10px]">
                {point.year}
              </span>
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}

type HorizontalBarsProps = {
  title: string;
  caption: string;
  points: SeriesPoint[];
  emptyLabel: string;
};

function HorizontalBars({ title, caption, points, emptyLabel }: HorizontalBarsProps) {
  const maxCount = Math.max(1, ...points.map((point) => point.count));

  return (
    <ChartFrame title={title} caption={caption}>
      {points.length > 0 ? (
        <ul className="mt-5 space-y-3.5">
          {points.map((point) => (
            <li key={point.label}>
              <div className="flex items-baseline justify-between gap-4 text-[12px]">
                <span className="truncate text-ink" title={point.label}>
                  {point.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted">{point.count}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/70">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(point.count / maxCount) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-[12px] text-muted">{emptyLabel}</p>
      )}
    </ChartFrame>
  );
}

export function PlotsView({ papers }: { papers: PaperGroup[] }) {
  const recordCount = papers.reduce((sum, paper) => sum + paper.records.length, 0);

  return (
    <div className="mt-5 space-y-5">
      <p className="text-[12px] text-muted">
        Aggregates include all {papers.length} papers in this result set, not just the current page.
      </p>

      <YearChart points={getPapersByYear(papers)} />

      <div className="grid gap-5 md:grid-cols-2">
        <HorizontalBars
          title="Papers by journal"
          caption={`${papers.length} papers grouped by journal.`}
          points={getPapersByJournal(papers)}
          emptyLabel="No journal data available."
        />
        <HorizontalBars
          title="Measurements by property"
          caption={`${recordCount} measurement records grouped by property.`}
          points={getMeasurementsByProperty(papers)}
          emptyLabel="No property data available."
        />
      </div>
    </div>
  );
}
