import { describe, expect, test } from "bun:test";

import { toMeasurement } from "./api";

describe("toMeasurement", () => {
  test("keeps optional paper enrichment fields", () => {
    const measurement = toMeasurement({
      record_id: "r1",
      article_pii: "S0167577X2031716X",
      doi: "10.1016/j.matlet.2020.129009",
      title: "Compositional control of Young's modulus in Ti–Al–Cr–N films",
      abstract: "A short abstract.",
    });

    expect(measurement.title).toBe("Compositional control of Young's modulus in Ti–Al–Cr–N films");
    expect(measurement.abstract).toBe("A short abstract.");
  });

  test("leaves enrichment fields undefined when the index has none", () => {
    const measurement = toMeasurement({ record_id: "r2", doi: "10.1063/1.4872145" });

    expect(measurement.title).toBeUndefined();
    expect(measurement.abstract).toBeUndefined();
  });
});
