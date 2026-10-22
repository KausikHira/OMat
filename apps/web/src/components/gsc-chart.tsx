"use client";

import dynamic from "next/dynamic";

import type { GscChart } from "@/lib/gsc";

// Plotly is browser-only: the real chart is loaded through dynamic() with ssr
// disabled, so the server renders the placeholder below and the browser swaps
// in the cartesian-only Plotly build (see gsc-chart-plot.tsx) after hydration.
const GscChartInner = dynamic(() => import("./gsc-chart-plot").then((m) => m.GscChartInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center text-[12px] text-muted">
      Loading chart…
    </div>
  ),
});

export function GscChartPlot({ chart }: { chart: GscChart }) {
  return <GscChartInner chart={chart} />;
}
