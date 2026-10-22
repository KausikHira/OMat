import { describe, expect, test } from "bun:test";

import { MEASUREMENTS } from "./mock-records";
import { groupMeasurementsByPaper } from "./papers";
import { getMeasurementsByProperty, getPapersByJournal, getPapersByYear } from "./plots";

const papers = groupMeasurementsByPaper(MEASUREMENTS);

describe("plot aggregates", () => {
  test("builds a sorted year series", () => {
    const years = getPapersByYear(papers);

    expect(years[0]?.year).toBe(2001);
    expect(years.at(-1)?.year).toBe(2022);
    expect(years).toHaveLength(12);
    expect(years.reduce((sum, point) => sum + point.count, 0)).toBe(papers.length);
  });

  test("groups papers by journal and measurements by property", () => {
    const journals = getPapersByJournal(papers);
    const properties = getMeasurementsByProperty(papers);

    expect(journals.reduce((sum, point) => sum + point.count, 0)).toBe(papers.length);
    expect(properties.reduce((sum, point) => sum + point.count, 0)).toBe(MEASUREMENTS.length);
    // The two mock glass papers measured density for every composition.
    expect(properties[0]?.label).toBe("Density");
    expect(properties[0]?.count).toBe(12);
  });

  test("returns empty series when there are no papers", () => {
    expect(getPapersByYear([])).toEqual([]);
    expect(getPapersByJournal([])).toEqual([]);
    expect(getMeasurementsByProperty([])).toEqual([]);
  });
});
