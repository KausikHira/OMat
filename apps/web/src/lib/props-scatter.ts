// Three-property scatter (port of plot_3_props_ultimate_with_filtering.ipynb).
//
// TS mirror of omat_core.props_plot for the mock fallback path — the API is
// the source of truth; this keeps the offline dev path representative.

import type { Measurement } from "@/lib/mock-records";

export type PropsAxis = { slug: string; name: string; unit: string };

export type PropsPoint = { x: number; y: number; z: number; highlighted: boolean };

export type PropsScatterChart = {
  propertyA: PropsAxis;
  propertyB: PropsAxis;
  propertyC: PropsAxis;
  thresholds: [number, number, number] | null;
  points: PropsPoint[];
  bounds: { a: [number, number]; b: [number, number]; c: [number, number] };
  counts: { merged: number; plotted: number; highlighted: number };
};

/** The notebook's active criteria ("criteria 8"): bold-lettering defaults. */
export const NOTEBOOK_DEFAULT_PROPERTIES = [
  "glass_transition_temperature",
  "activation_energy",
  "crystallization_temperature",
] as const;

export const NOTEBOOK_DEFAULT_THRESHOLDS: [number, number, number] = [600, 2, 800];

/**
 * matplotlib's `spring` colormap: red constant, green 0 -> 1, blue 1 -> 0.
 * Returns a CSS hex color for t in [0, 1].
 */
export function springColormap(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const to255 = (value: number) =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to255(1)}${to255(clamped)}${to255(1 - clamped)}`;
}

/** Linear-interpolation quantile matching pandas `quantile`. */
export function percentile(values: number[], q: number): number {
  const ordered = [...values].sort((a, b) => a - b);
  if (ordered.length === 0) {
    throw new Error("percentile of an empty sequence");
  }
  if (ordered.length === 1) {
    return ordered[0] as number;
  }
  const position = (ordered.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, ordered.length - 1);
  const weight = position - lower;
  return (ordered[lower] as number) * (1 - weight) + (ordered[upper] as number) * weight;
}

/**
 * Materials measured for all three properties, 1st/99th percentile filtered
 * (a material outside any bound is dropped whole), with all-or-nothing `>=`
 * threshold highlighting.
 */
export function buildPropsScatter(
  records: Measurement[],
  propertyA: string,
  propertyB: string,
  propertyC: string,
  thresholds: [number, number, number] | null = null,
): PropsScatterChart {
  const materials = new Map<string, Map<string, Measurement>>();
  for (const record of records) {
    if (
      record.property.slug !== propertyA &&
      record.property.slug !== propertyB &&
      record.property.slug !== propertyC
    ) {
      continue;
    }
    const key = `${record.pii}|${record.composition}`;
    const bySlug = materials.get(key) ?? new Map<string, Measurement>();
    bySlug.set(record.property.slug, record);
    materials.set(key, bySlug);
  }

  const merged: { x: number; y: number; z: number; axis: PropsAxis[] }[] = [];
  for (const bySlug of materials.values()) {
    const aRecord = bySlug.get(propertyA);
    const bRecord = bySlug.get(propertyB);
    const cRecord = bySlug.get(propertyC);
    if (!aRecord || !bRecord || !cRecord) {
      continue;
    }
    if (aRecord.property.value <= 0 || bRecord.property.value <= 0 || cRecord.property.value <= 0) {
      continue; // notebook drops zero/NaN values before filtering
    }
    merged.push({
      x: aRecord.property.value,
      y: bRecord.property.value,
      z: cRecord.property.value,
      axis: [aRecord, bRecord, cRecord].map((record) => ({
        slug: record.property.slug,
        name: record.property.name,
        unit: record.property.unit || "",
      })),
    });
  }

  const axisValues = (index: "x" | "y" | "z") => merged.map((material) => material[index]);
  const bounds = {
    a: axisBounds(axisValues("x")),
    b: axisBounds(axisValues("y")),
    c: axisBounds(axisValues("z")),
  };

  const kept = merged.filter(
    (material) =>
      bounds.a[0] <= material.x &&
      material.x <= bounds.a[1] &&
      bounds.b[0] <= material.y &&
      material.y <= bounds.b[1] &&
      bounds.c[0] <= material.z &&
      material.z <= bounds.c[1],
  );

  const points: PropsPoint[] = kept.map((material) => {
    const highlighted = thresholds
      ? material.x >= thresholds[0] && material.y >= thresholds[1] && material.z >= thresholds[2]
      : false;
    return { x: material.x, y: material.y, z: material.z, highlighted };
  });

  const labels = (index: number, fallback: string): PropsAxis =>
    (kept[0]?.axis[index] as PropsAxis | undefined) ?? { slug: fallback, name: fallback, unit: "" };

  return {
    propertyA: labels(0, propertyA),
    propertyB: labels(1, propertyB),
    propertyC: labels(2, propertyC),
    thresholds,
    points,
    bounds,
    counts: {
      merged: merged.length,
      plotted: kept.length,
      highlighted: points.filter((point) => point.highlighted).length,
    },
  };
}

function axisBounds(values: number[]): [number, number] {
  if (values.length === 0) {
    return [0, 0];
  }
  return [percentile(values, 0.01), percentile(values, 0.99)];
}
