// Pure chart math for the SVG GSC chart. No chart library: the plot is
// filled polygons + scatter dots + axes, all renderable as inline SVG in the
// server response (nothing to load client-side, nothing to fail).

export type ChartDomain = { min: number; max: number };

/** Value domain padded by 5% so hulls never touch the plot edge. */
export function computeDomain(values: number[]): ChartDomain {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return { min: 0, max: 1 };
  }
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const padding = (max - min) * 0.05;
  return { min: min - padding, max: max + padding };
}

/** Linear scale: domain -> [rangeStart, rangeEnd] in SVG units. */
export function scaleLinear(domain: ChartDomain, range: readonly [number, number]) {
  const span = domain.max - domain.min || 1;
  const [start, end] = range;
  return (value: number): number => start + ((value - domain.min) / span) * (end - start);
}

/** Human-friendly tick values: steps of 1/2/5 × 10^n across the domain. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return [min].filter(Number.isFinite);
  }
  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1) * magnitude;
  const ticks: number[] = [];
  for (let tick = Math.ceil(min / step) * step; tick <= max + step * 1e-9; tick += step) {
    ticks.push(Number(tick.toPrecision(12)));
  }
  return ticks;
}

/** `['Ag', 'S', 'Sb']` (python repr or JSON) -> `Ag · S · Sb` for the legend. */
export function familyLabel(family: string): string {
  const elements = family
    .replace(/[[\]'"]/g, "")
    .split(",")
    .map((element) => element.trim())
    .filter(Boolean);
  return elements.length > 0 ? elements.join(" · ") : family;
}
