import { describe, expect, test } from "bun:test";

import { computeDomain, familyLabel, niceTicks, scaleLinear } from "./gsc-chart";

describe("computeDomain", () => {
  test("pads the domain by 5% on each side", () => {
    const domain = computeDomain([0, 100]);
    expect(domain.min).toBe(-5);
    expect(domain.max).toBe(105);
  });

  test("degenerate single-value domains expand instead of collapsing", () => {
    const domain = computeDomain([7, 7, 7]);
    expect(domain.min).toBeLessThan(7);
    expect(domain.max).toBeGreaterThan(7);
  });

  test("empty input falls back to a 0..1 domain", () => {
    expect(computeDomain([])).toEqual({ min: 0, max: 1 });
  });
});

describe("scaleLinear", () => {
  test("maps the domain onto the pixel range, y inverted for SVG", () => {
    const scale = scaleLinear({ min: 0, max: 10 }, [400, 0]);
    expect(scale(0)).toBe(400);
    expect(scale(10)).toBe(0);
    expect(scale(5)).toBe(200);
  });

  test("constant domains divide by 1, never by 0", () => {
    const scale = scaleLinear({ min: 5, max: 5 }, [0, 100]);
    expect(Number.isFinite(scale(5))).toBe(true);
  });
});

describe("niceTicks", () => {
  test("produces 1/2/5-magnitude steps inside the domain", () => {
    const ticks = niceTicks(0.3, 9.7);
    expect(ticks[0]).toBeGreaterThanOrEqual(0.3);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(9.7);
    for (const tick of ticks) {
      expect(Number.isFinite(tick)).toBe(true);
    }
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks.length).toBeLessThan(12);
  });

  test("handles tiny scientific-notation ranges", () => {
    const ticks = niceTicks(1.04e-9, 5.1e-9);
    expect(ticks.length).toBeGreaterThan(2);
  });
});

describe("familyLabel", () => {
  test("pretty-prints python and JSON family reprs", () => {
    expect(familyLabel("['Ag', 'Ge', 'S', 'Sb']")).toBe("Ag · Ge · S · Sb");
    expect(familyLabel('["Al","O"]')).toBe("Al · O");
  });

  test("keeps unparseable labels intact", () => {
    expect(familyLabel("unknown")).toBe("unknown");
  });
});
