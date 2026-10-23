// Three-property scatter as inline SVG, rendered on the server.
//
// Port of plot_3_props_ultimate_with_filtering.ipynb: (x, y) points colored
// by the third property (matplotlib `spring` colormap, black edges), and
// materials meeting all three bold-lettered criteria ringed in blue. No
// chart library — nothing to load client-side, nothing to fail.

import { computeDomain, niceTicks, scaleLinear } from "@/lib/gsc-chart";
import { type PropsScatterChart, springColormap } from "@/lib/props-scatter";
import { formatValue } from "@/lib/search";

const WIDTH = 800;
const HEIGHT = 420;
const MARGIN = { top: 16, right: 110, bottom: 48, left: 64 };
const GRID = "rgba(127,127,127,0.3)";
const RING_BLUE = "#0000ff";

function axisTitle(name: string, unit: string) {
  return `${name} (${unit || "—"})`;
}

export function criteriaLine(chart: PropsScatterChart): string | null {
  const { thresholds, propertyA, propertyB, propertyC } = chart;
  if (!thresholds) {
    return null;
  }
  const [tA, tB, tC] = thresholds;
  const withUnit = (axis: { name: string; unit: string }, threshold: number) =>
    `${axis.name} ≥ ${formatValue(threshold)}${axis.unit ? ` ${axis.unit}` : ""}`;
  return [withUnit(propertyA, tA), withUnit(propertyB, tB), withUnit(propertyC, tC)].join("  ·  ");
}

export function PropsScatterChartPlot({ chart }: { chart: PropsScatterChart }) {
  if (chart.points.length === 0) {
    return null; // the section renders the empty-state message
  }

  const xs = chart.points.map((point) => point.x);
  const ys = chart.points.map((point) => point.y);
  const zs = chart.points.map((point) => point.z);
  const xDomain = computeDomain(xs);
  const yDomain = computeDomain(ys);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  const zSpan = zMax - zMin || 1;
  const x = scaleLinear(xDomain, [MARGIN.left, WIDTH - MARGIN.right]);
  const y = scaleLinear(yDomain, [HEIGHT - MARGIN.bottom, MARGIN.top]);
  const xTicks = niceTicks(xDomain.min, xDomain.max);
  const yTicks = niceTicks(yDomain.min, yDomain.max);

  // notebooks draw plain points first, then blue rings on top
  const plain = chart.points.filter((point) => !point.highlighted);
  const highlighted = chart.points.filter((point) => point.highlighted);

  // Stable keys from coordinates (duplicate values get a per-coordinate
  // occurrence number; no array-index keys).
  const keyFactory = () => {
    const seen = new Map<string, number>();
    return (point: { x: number; y: number; z: number }) => {
      const base = `${point.x}|${point.y}|${point.z}`;
      const occurrence = seen.get(base) ?? 0;
      seen.set(base, occurrence + 1);
      return `${base}#${occurrence}`;
    };
  };
  const plainKey = keyFactory();
  const highlightedKey = keyFactory();

  const colorbarTop = MARGIN.top;
  const colorbarBottom = HEIGHT - MARGIN.bottom;
  const colorbarX = WIDTH - 64;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${axisTitle(chart.propertyA.name, chart.propertyA.unit)} versus ${axisTitle(
          chart.propertyB.name,
          chart.propertyB.unit,
        )}, colored by ${axisTitle(chart.propertyC.name, chart.propertyC.unit)}`}
        className="w-full text-muted"
      >
        {/* grid + tick labels (dashed, notebook alpha 0.3) */}
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              x1={x(tick)}
              y1={MARGIN.top}
              x2={x(tick)}
              y2={HEIGHT - MARGIN.bottom}
              stroke={GRID}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={x(tick)}
              y={HEIGHT - MARGIN.bottom + 18}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
            >
              {formatValue(tick)}
            </text>
          </g>
        ))}
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={MARGIN.left}
              y1={y(tick)}
              x2={WIDTH - MARGIN.right}
              y2={y(tick)}
              stroke={GRID}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={MARGIN.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize={11}
              fill="currentColor"
            >
              {formatValue(tick)}
            </text>
          </g>
        ))}

        {/* axis titles */}
        <text
          x={(MARGIN.left + WIDTH - MARGIN.right) / 2}
          y={HEIGHT - 10}
          textAnchor="middle"
          fontSize={12}
          fill="currentColor"
        >
          {axisTitle(chart.propertyA.name, chart.propertyA.unit)}
        </text>
        <text
          transform={`rotate(-90 14 ${(MARGIN.top + HEIGHT - MARGIN.bottom) / 2})`}
          x={14}
          y={(MARGIN.top + HEIGHT - MARGIN.bottom) / 2}
          textAnchor="middle"
          fontSize={12}
          fill="currentColor"
        >
          {axisTitle(chart.propertyB.name, chart.propertyB.unit)}
        </text>

        {/* plain points: colored by z, black edges (notebook: c=z, cmap=spring,
            edgecolor='k', alpha=0.8, s=40) */}
        {plain.map((point) => (
          <circle
            key={plainKey(point)}
            cx={x(point.x)}
            cy={y(point.y)}
            r={4}
            fill={springColormap((point.z - zMin) / zSpan)}
            fillOpacity={0.8}
            stroke="#000000"
            strokeWidth={0.8}
          >
            <title>{`${formatValue(point.x)} / ${formatValue(point.y)} / ${formatValue(point.z)}`}</title>
          </circle>
        ))}

        {/* criteria materials: blue ring drawn over the point (notebook:
            facecolor='none', edgecolor='blue', linewidths=1.5) */}
        {highlighted.map((point) => (
          <g key={highlightedKey(point)}>
            <circle
              cx={x(point.x)}
              cy={y(point.y)}
              r={4}
              fill={springColormap((point.z - zMin) / zSpan)}
              fillOpacity={0.8}
              stroke="#000000"
              strokeWidth={0.8}
            />
            <circle
              cx={x(point.x)}
              cy={y(point.y)}
              r={6.5}
              fill="none"
              stroke={RING_BLUE}
              strokeWidth={1.5}
              opacity={0.9}
            >
              <title>{`${chart.propertyC.name} = ${formatValue(point.z)} — meets all criteria`}</title>
            </circle>
          </g>
        ))}

        {/* colorbar: spring gradient, low at the bottom like matplotlib */}
        <defs>
          <linearGradient id="spring-colorbar" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={springColormap(0)} />
            <stop offset="50%" stopColor={springColormap(0.5)} />
            <stop offset="100%" stopColor={springColormap(1)} />
          </linearGradient>
        </defs>
        <rect
          x={colorbarX}
          y={colorbarTop}
          width={12}
          height={colorbarBottom - colorbarTop}
          fill="url(#spring-colorbar)"
          stroke="rgba(127,127,127,0.5)"
          strokeWidth={0.5}
        />
        <text x={colorbarX + 18} y={colorbarTop + 4} fontSize={10} fill="currentColor">
          {formatValue(zMax)}
        </text>
        <text x={colorbarX + 18} y={colorbarBottom + 2} fontSize={10} fill="currentColor">
          {formatValue(zMin)}
        </text>
        <text
          transform={`rotate(-90 ${colorbarX - 8} ${(colorbarTop + colorbarBottom) / 2})`}
          x={colorbarX - 8}
          y={(colorbarTop + colorbarBottom) / 2}
          textAnchor="middle"
          fontSize={11}
          fill="currentColor"
        >
          {axisTitle(chart.propertyC.name, chart.propertyC.unit)}
        </text>
      </svg>
    </div>
  );
}
