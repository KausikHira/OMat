"use client";

// Inner chart component: imports Plotly at module scope, so it must never be
// server-rendered. gsc-chart.tsx loads it with dynamic(..., { ssr: false }).
//
// cartesian-dist-min keeps the bundle to scatter/line/bar traces (~1 MB
// instead of ~3.5 MB for the full plotly.js build the react-plotly.js peer
// pulls in) — the GSC chart only draws filled scatter hulls.

import type { ReactElement } from "react";

import Plotly from "plotly.js-cartesian-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";

import type { GscChart } from "@/lib/gsc";
import { GSC_COLORS } from "@/lib/gsc";

// Minimal local trace/layout types. Importing from "plotly.js" is unsafe here:
// the store carries @types/plotly.js v2 (app) and v3 (via react-plotly.js), and
// the two disagree on Data/Layout. Structural typing avoids the split entirely.
type Trace = {
  x: (number | undefined)[];
  y: (number | undefined)[];
  type: "scatter";
  mode?: "lines" | "markers";
  line?: { color: string; width?: number };
  marker?: { color: string; size?: number; opacity?: number };
  fill?: "toself";
  fillcolor?: string;
  name?: string;
  showlegend?: boolean;
  hoverinfo?: "name";
  hovertemplate?: string;
};

type Axis = {
  title?: { text: string };
  gridcolor?: string;
  zeroline?: boolean;
  zerolinecolor?: string;
};

type LayoutShape = {
  margin?: { l: number; r: number; t: number; b: number };
  paper_bgcolor?: string;
  plot_bgcolor?: string;
  showlegend?: boolean;
  legend?: { orientation: "v"; x: number; y: number; font: { size: number } };
  xaxis?: Axis;
  yaxis?: Axis;
};

type PlotParams = {
  data: Trace[];
  layout: LayoutShape;
  config: { responsive: boolean; displayModeBar: boolean };
  style?: { width: string; height: number };
  useResizeHandler?: boolean;
};

// The factory returns a component typed against Plotly's own (version-split)
// types; our structural subset is assignable to every plotly.js version.
const Plot = createPlotlyComponent(Plotly) as unknown as (props: PlotParams) => ReactElement;

function traces(chart: GscChart): Trace[] {
  const result: Trace[] = [];
  chart.families.forEach((family, index) => {
    const color = GSC_COLORS[index % GSC_COLORS.length] as string;
    const closed = [...family.hull, family.hull[0] ?? { x: 0, y: 0 }];
    result.push({
      x: closed.map((point) => point.x),
      y: closed.map((point) => point.y),
      type: "scatter",
      mode: "lines",
      line: { color, width: 1 },
      fill: "toself",
      fillcolor: `${color}4D`,
      name: `${index + 1}: ${family.family}`,
      hoverinfo: "name",
    });
    result.push({
      x: family.points.map((point) => point.x),
      y: family.points.map((point) => point.y),
      type: "scatter",
      mode: "markers",
      marker: { color, size: 6, opacity: 0.75 },
      name: family.family,
      showlegend: false,
      hovertemplate: "%{x} / %{y}<extra></extra>",
    });
  });
  return result;
}

export function GscChartInner({ chart }: { chart: GscChart }) {
  const layout: LayoutShape = {
    margin: { l: 56, r: 8, t: 12, b: 44 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    showlegend: true,
    legend: { orientation: "v", x: 1.02, y: 1, font: { size: 10 } },
    xaxis: {
      title: { text: `${chart.propertyA.name} (${chart.propertyA.unit || "—"})` },
      gridcolor: "rgba(127,127,127,0.25)",
      zeroline: true,
      zerolinecolor: "rgba(127,127,127,0.4)",
    },
    yaxis: {
      title: { text: `${chart.propertyB.name} (${chart.propertyB.unit || "—"})` },
      gridcolor: "rgba(127,127,127,0.25)",
      zeroline: true,
      zerolinecolor: "rgba(127,127,127,0.4)",
    },
  };

  return (
    <Plot
      data={traces(chart)}
      layout={layout}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%", height: 420 }}
      useResizeHandler
    />
  );
}
