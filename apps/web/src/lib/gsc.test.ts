import { describe, expect, test } from "bun:test";

import { buildGscChart, chaikinSmooth, convexHull, familyName, pairableProperties } from "./gsc";
import { MEASUREMENTS, type Measurement } from "./mock-records";

const square = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

describe("gsc primitives", () => {
  test("familyName sorts and dedupes elements", () => {
    expect(familyName(["S", "Ag", "S", "Ge"])).toBe('["Ag","Ge","S"]');
    expect(familyName([])).toBe("[]");
  });

  test("convexHull drops interior points", () => {
    const hull = convexHull([...square, { x: 0.5, y: 0.5 }]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual({ x: 0.5, y: 0.5 });
  });

  test("chaikinSmooth rounds and grows the polygon", () => {
    const smoothed = chaikinSmooth(square, 2);
    expect(smoothed).toHaveLength(16); // 4 -> 8 -> 16, closed
    // Points on the straight edges keep the edge coordinate (0 or 1), so the
    // shape stays inside its bounding box; what corner cutting removes are
    // the sharp corners themselves.
    for (const point of smoothed) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
    for (const corner of square) {
      expect(smoothed).not.toContainEqual(corner);
    }
  });
});

describe("buildGscChart", () => {
  test("pairs materials and builds family hulls from the mock data", () => {
    const chart = buildGscChart(MEASUREMENTS, "density", "hardness");

    expect(chart.propertyA.name).toBe("Density");
    expect(chart.propertyA.unit).toBe("g/cm³");
    expect(chart.propertyB.unit).toBe("GPa");

    // The AgI-GeS2-Sb2S3 glass paper measured both properties for 6 materials.
    const glass = chart.families.find((family) => family.family.includes('"Ag"'));
    expect(glass).toBeDefined();
    expect(glass?.count).toBe(6);
    expect(glass?.points).toHaveLength(6);
    expect(glass?.hull.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(chart.totalPoints).toBe(6);
  });

  test("returns an empty chart for properties no material measured twice", () => {
    const chart = buildGscChart(MEASUREMENTS, "band-gap", "hardness");
    expect(chart.families).toEqual([]);
    expect(chart.totalPoints).toBe(0);
  });

  test("pairs density with glass transition temperature", () => {
    const chart = buildGscChart(MEASUREMENTS, "density", "glass_transition_temperature");
    // The Ba-La-Te-O-F tellurite family has 5 materials measured for both.
    const family = chart.families[0];
    expect(family?.count).toBe(5);
  });
});

describe("pairableProperties", () => {
  test("lists only properties measured alongside another property", () => {
    const options = pairableProperties(MEASUREMENTS);
    const slugs = options.map((option) => option.slug);

    expect(slugs).toContain("density");
    expect(slugs).toContain("hardness");
    expect(slugs).toContain("glass_transition_temperature");
    expect(options[0]?.slug).toBe("density"); // most pairable first
  });

  test("returns nothing when no material has two properties", () => {
    const [first] = MEASUREMENTS;
    if (!first) {
      throw new Error("mock dataset is empty");
    }
    const single: Measurement[] = [{ ...first, id: "only-1" }];
    expect(pairableProperties(single)).toEqual([]);
  });
});
