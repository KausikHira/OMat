import { describe, expect, test } from "bun:test";

import { MEASUREMENTS, type Measurement } from "./mock-records";
import {
  NOTEBOOK_DEFAULT_THRESHOLDS,
  buildPropsScatter,
  percentile,
  springColormap,
} from "./props-scatter";

describe("springColormap", () => {
  test("reproduces matplotlib spring: magenta low, yellow high", () => {
    expect(springColormap(0)).toBe("#ff00ff");
    expect(springColormap(1)).toBe("#ffff00");
    expect(springColormap(0.5)).toBe("#ff8080");
  });

  test("clamps out-of-range input", () => {
    expect(springColormap(-1)).toBe(springColormap(0));
    expect(springColormap(2)).toBe(springColormap(1));
  });
});

describe("percentile", () => {
  test("matches pandas quantile interpolation", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(values, 0.01)).toBeCloseTo(1.09);
    expect(percentile(values, 0.5)).toBeCloseTo(5.5);
    expect(percentile(values, 0.99)).toBeCloseTo(9.91);
  });

  test("single-value sequences return the value", () => {
    expect(percentile([4.2], 0.01)).toBe(4.2);
  });
});

describe("buildPropsScatter", () => {
  const base: Measurement = MEASUREMENTS[0] as Measurement;

  function material(
    pii: string,
    composition: string,
    properties: [string, string, number, string][],
  ): Measurement[] {
    return properties.map(([slug, name, value, unit], index) => ({
      ...base,
      id: `${pii}-${composition}-${slug}-${index}`,
      pii,
      composition,
      property: { name, slug, value, unit },
    }));
  }

  test("merges only materials with all three properties and flags criteria", () => {
    const records = [
      ...material("P1", "c1", [
        ["tg", "Glass transition temperature", 650, "K"],
        ["ea", "Activation energy", 2.5, "eV"],
        ["tx", "Crystallization temperature", 820, "K"],
      ]),
      // two of three: never merged
      ...material("P2", "c1", [
        ["tg", "Glass transition temperature", 700, "K"],
        ["ea", "Activation energy", 3.0, "eV"],
      ]),
    ];

    const chart = buildPropsScatter(records, "tg", "ea", "tx", [600, 2, 800]);

    expect(chart.counts.merged).toBe(1);
    expect(chart.counts.plotted).toBe(1);
    expect(chart.counts.highlighted).toBe(1);
    expect(chart.points[0]).toEqual({ x: 650, y: 2.5, z: 820, highlighted: true });
    expect(chart.propertyA.name).toBe("Glass transition temperature");
    expect(chart.propertyC.unit).toBe("K");
    expect(chart.thresholds).toEqual([600, 2, 800]);
  });

  test("without thresholds nothing is highlighted", () => {
    const records = [
      ...material("P1", "c1", [
        ["tg", "Glass transition temperature", 650, "K"],
        ["ea", "Activation energy", 2.5, "eV"],
        ["tx", "Crystallization temperature", 820, "K"],
      ]),
    ];
    const chart = buildPropsScatter(records, "tg", "ea", "tx");
    expect(chart.thresholds).toBeNull();
    expect(chart.points[0]?.highlighted).toBe(false);
  });

  test("empty input is graceful", () => {
    const chart = buildPropsScatter([], "tg", "ea", "tx");
    expect(chart.points).toEqual([]);
    expect(chart.counts).toEqual({ merged: 0, plotted: 0, highlighted: 0 });
  });

  test("notebook default thresholds are criteria 8", () => {
    expect(NOTEBOOK_DEFAULT_THRESHOLDS).toEqual([600, 2, 800]);
  });
});
