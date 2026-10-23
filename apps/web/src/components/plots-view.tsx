import type { ReactNode } from "react";

import type { PairOption } from "@/lib/gsc";
import type { PaperGroup } from "@/lib/papers";
import {
  type SeriesPoint,
  type YearPoint,
  getMeasurementsByProperty,
  getPapersByJournal,
  getPapersByYear,
} from "@/lib/plots";
import type { PropsScatterChart } from "@/lib/props-scatter";
import type { SearchState } from "@/lib/search";

import { PropsScatterChartPlot, criteriaLine } from "./props-scatter-chart";

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

type TripleSelectProps = {
  query: SearchState;
  triple: { a: string; b: string; c: string };
  thresholds: [number, number, number] | null;
  options: PairOption[];
};

/**
 * Plain GET form so any property triple + criteria set is a shareable URL
 * (propX / propY / propZ, thX / thY / thZ), mirroring the notebook's
 * criteria-8 style thresholds.
 */
function TripleSelect({ query, triple, thresholds, options }: TripleSelectProps) {
  if (options.length < 3) {
    return null; // not enough multi-property materials in this result set
  }

  const select = (name: string, label: string, value: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="border border-line-strong bg-panel px-2.5 py-1.5 text-ink outline-none"
      >
        {options.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const threshold = (name: string, label: string, value: number | undefined) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted">{label} ≥</span>
      <input
        type="number"
        step="any"
        name={name}
        defaultValue={value}
        placeholder="—"
        className="w-24 border border-line-strong bg-panel px-2.5 py-1.5 text-ink outline-none"
      />
    </label>
  );

  return (
    <form
      action="/search"
      method="get"
      aria-label="Choose the plotted properties and criteria"
      className="flex flex-wrap items-end gap-4 text-[12px]"
    >
      <input type="hidden" name="tab" value="plots" />
      {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
      {query.elements.map((element) => (
        <input key={element} type="hidden" name="element" value={element} />
      ))}
      {query.applications.map((application) => (
        <input key={application} type="hidden" name="application" value={application} />
      ))}
      {query.journal ? <input type="hidden" name="journal" value={query.journal} /> : null}

      {select("propX", "X property", triple.a)}
      {select("propY", "Y property", triple.b)}
      {select("propZ", "Color property", triple.c)}
      {threshold("thX", "X criteria", thresholds?.[0])}
      {threshold("thY", "Y criteria", thresholds?.[1])}
      {threshold("thZ", "Color criteria", thresholds?.[2])}
      <button
        type="submit"
        className="rounded-[7px] bg-accent px-4 py-2 text-[12px] font-medium text-accent-ink transition-opacity hover:opacity-85"
      >
        Update chart
      </button>
    </form>
  );
}

type PropsScatterSectionProps = {
  query: SearchState;
  triple: { a: string; b: string; c: string };
  thresholds: [number, number, number] | null;
  options: PairOption[];
  chart: PropsScatterChart;
};

function PropsScatterSection({
  query,
  triple,
  thresholds,
  options,
  chart,
}: PropsScatterSectionProps) {
  const criteria = criteriaLine(chart);
  const { counts } = chart;

  return (
    <ChartFrame
      title="Property map with material criteria"
      caption={`${counts.plotted} materials measured for all three properties (${counts.merged} before 1st/99th percentile filtering). Materials meeting every criterion are ringed in blue.`}
    >
      {criteria ? (
        <p className="mt-4 text-[13px] font-semibold text-ink">{criteria}</p>
      ) : (
        <p className="mt-4 text-[12px] text-muted">
          Enter all three criteria below to highlight the materials that satisfy them.
        </p>
      )}

      <div className="mt-4">
        <TripleSelect query={query} triple={triple} thresholds={thresholds} options={options} />
      </div>

      <div className="mt-4">
        {chart.points.length > 0 ? (
          <PropsScatterChartPlot chart={chart} />
        ) : (
          <p className="py-10 text-center text-[12px] text-muted">
            No material in this result set was measured for {chart.propertyA.name.toLowerCase()},{" "}
            {chart.propertyB.name.toLowerCase()}, and {chart.propertyC.name.toLowerCase()} together.
            Pick another combination.
          </p>
        )}
      </div>
    </ChartFrame>
  );
}

export function PlotsView({
  papers,
  propsScatter,
}: {
  papers: PaperGroup[];
  propsScatter: PropsScatterSectionProps;
}) {
  const recordCount = papers.reduce((sum, paper) => sum + paper.records.length, 0);

  return (
    <div className="mt-5 space-y-5">
      <p className="text-[12px] text-muted">
        Aggregates include all {papers.length} papers in this result set, not just the current page.
      </p>

      <PropsScatterSection {...propsScatter} />

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
