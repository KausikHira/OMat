import type { Measurement } from "@/lib/mock-records";

export type GscPoint = { x: number; y: number };

export type GscAxis = { slug: string; name: string; unit: string };

export type GscFamily = {
  family: string;
  count: number;
  points: GscPoint[];
  /** Smoothed, closed convex hull polygon. */
  hull: GscPoint[];
};

export type GscChart = {
  propertyA: GscAxis;
  propertyB: GscAxis;
  families: GscFamily[];
  totalPoints: number;
};

export const MAX_FAMILIES = 12;
export const MIN_UNIQUE_POINTS = 3;

/** Colorblind-friendly palette from the GSC notebook. */
export const GSC_COLORS = [
  "#7AE43F",
  "#F0E442",
  "#C556A4",
  "#009E73",
  "#D55E00",
  "#56B4E9",
  "#EFB4B3",
  "#b3bfd1",
  "#897FF1",
  "#E69F00",
  "#ff80ff",
  "#40E0D0",
] as const;

export function familyName(elements: string[]): string {
  return JSON.stringify([...new Set(elements.filter(Boolean))].sort());
}

function cross(origin: GscPoint, a: GscPoint, b: GscPoint): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

/** Andrew monotone chain. Returns hull vertices in CCW order (open loop). */
export function convexHull(points: GscPoint[]): GscPoint[] {
  if (points.length < 3) {
    return [...points];
  }
  const ordered = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const build = (direction: 1 | -1): GscPoint[] => {
    const chain: GscPoint[] = [];
    for (const point of direction === 1 ? ordered : [...ordered].reverse()) {
      while (
        chain.length >= 2 &&
        cross(chain[chain.length - 2] as GscPoint, chain[chain.length - 1] as GscPoint, point) <= 0
      ) {
        chain.pop();
      }
      chain.push(point);
    }
    return chain;
  };
  const lower = build(1);
  const upper = build(-1);
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Closed-polygon Chaikin corner cutting: rounds the hull into a blob. */
export function chaikinSmooth(points: GscPoint[], iterations = 2): GscPoint[] {
  if (points.length < 3) {
    return [...points];
  }
  let smoothed = [...points];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next: GscPoint[] = [];
    const count = smoothed.length;
    for (let i = 0; i < count; i += 1) {
      const current = smoothed[i] as GscPoint;
      const following = smoothed[(i + 1) % count] as GscPoint;
      next.push({
        x: 0.75 * current.x + 0.25 * following.x,
        y: 0.75 * current.y + 0.25 * following.y,
      });
      next.push({
        x: 0.25 * current.x + 0.75 * following.x,
        y: 0.25 * current.y + 0.75 * following.y,
      });
    }
    smoothed = next;
  }
  return smoothed;
}

function isDegenerate(points: GscPoint[]): boolean {
  if (points.length === 0) {
    return true;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return Math.max(...xs) - Math.min(...xs) === 0 || Math.max(...ys) - Math.min(...ys) === 0;
}

function uniquePoints(points: GscPoint[]): GscPoint[] {
  const seen = new Set<string>();
  const unique: GscPoint[] = [];
  for (const point of points) {
    const key = `${point.x}|${point.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(point);
    }
  }
  return unique;
}

/**
 * Materials are joined across records by (PII, composition): one source
 * material measured for both chosen properties becomes one point. Families
 * are the element sets of those materials, ranked by material count then
 * name, capped like the notebook's top-12.
 */
export function buildGscChart(
  records: Measurement[],
  propertyA: string,
  propertyB: string,
  maxFamilies: number = MAX_FAMILIES,
): GscChart {
  const materials = new Map<string, Map<string, Measurement>>();
  for (const record of records) {
    if (record.property.slug !== propertyA && record.property.slug !== propertyB) {
      continue;
    }
    const key = `${record.pii}|${record.composition}`;
    let bySlug = materials.get(key);
    if (!bySlug) {
      bySlug = new Map<string, Measurement>();
      materials.set(key, bySlug);
    }
    bySlug.set(record.property.slug, record);
  }

  const pointsByFamily = new Map<string, GscPoint[]>();
  const labels = new Map<string, GscAxis>([
    [propertyA, { slug: propertyA, name: "", unit: "" }],
    [propertyB, { slug: propertyB, name: "", unit: "" }],
  ]);
  let totalPoints = 0;

  for (const bySlug of materials.values()) {
    const aRecord = bySlug.get(propertyA);
    const bRecord = bySlug.get(propertyB);
    if (!aRecord || !bRecord) {
      continue; // material measured only one of the two properties
    }
    if (aRecord.property.value <= 0 || bRecord.property.value <= 0) {
      continue; // notebook: drop rows where either property is 0/NaN
    }
    for (const record of [aRecord, bRecord]) {
      const axis = labels.get(record.property.slug);
      if (axis && !axis.name) {
        axis.name = record.property.name;
        axis.unit = record.property.unit ?? "";
      }
    }
    if (aRecord.elements.length === 0) {
      continue; // no composition: no family to belong to
    }
    const family = familyName(aRecord.elements);
    const familyPoints = pointsByFamily.get(family) ?? [];
    familyPoints.push({ x: aRecord.property.value, y: bRecord.property.value });
    pointsByFamily.set(family, familyPoints);
    totalPoints += 1;
  }

  const ranked = [...pointsByFamily.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, maxFamilies);

  const families: GscFamily[] = [];
  for (const [family, points] of ranked) {
    const unique = uniquePoints(points);
    if (unique.length < MIN_UNIQUE_POINTS || isDegenerate(unique)) {
      continue; // notebook: skip families a hull cannot cover
    }
    const hull = convexHull(unique).map((point) => ({
      x: Math.max(point.x, 0),
      y: Math.max(point.y, 0),
    }));
    if (hull.length < MIN_UNIQUE_POINTS) {
      // Collinear points: the chain collapses them to a 2-vertex "hull"
      // with no area — there is no blob to draw.
      continue;
    }
    families.push({
      family,
      count: points.length,
      points: unique,
      hull: chaikinSmooth(hull),
    });
  }

  return {
    propertyA: labels.get(propertyA) ?? { slug: propertyA, name: propertyA, unit: "" },
    propertyB: labels.get(propertyB) ?? { slug: propertyB, name: propertyB, unit: "" },
    families,
    totalPoints,
  };
}

export type PairOption = { slug: string; label: string; count: number };

/** Properties that appear in at least one multi-property material. */
export function pairableProperties(records: Measurement[]): PairOption[] {
  const materials = new Map<string, Map<string, Measurement>>();
  for (const record of records) {
    const key = `${record.pii}|${record.composition}`;
    let bySlug = materials.get(key);
    if (!bySlug) {
      bySlug = new Map<string, Measurement>();
      materials.set(key, bySlug);
    }
    bySlug.set(record.property.slug, record);
  }

  const counts = new Map<string, PairOption>();
  for (const bySlug of materials.values()) {
    if (bySlug.size < 2) {
      continue;
    }
    for (const record of bySlug.values()) {
      const option = counts.get(record.property.slug) ?? {
        slug: record.property.slug,
        label: record.property.name,
        count: 0,
      };
      option.count += 1;
      counts.set(record.property.slug, option);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
