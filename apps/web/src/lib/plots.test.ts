import { describe, expect, test } from "bun:test";

import { MEASUREMENTS } from "./mock-records";
import { groupMeasurementsByPaper } from "./papers";
import { getMeasurementsByProperty, getPapersByJournal, getPapersByYear } from "./plots";

const papers = groupMeasurementsByPaper(MEASUREMENTS);

describe("plot aggregates", () => {
  test("builds a sorted year series", () => {
    const years = getPapersByYear(papers);

    expect(years[0]?.year).toBe(2012);
    expect(years.at(-1)?.year).toBe(2022);
    expect(years).toHaveLength(11);
    expect(years.reduce((sum, point) => sum + point.count, 0)).toBe(papers.length);
  });

  test("groups papers by journal and measurements by property", () => {
    const journals = getPapersByJournal(papers);
    const properties = getMeasurementsByProperty(papers);

    expect(journals.reduce((sum, point) => sum + point.count, 0)).toBe(papers.length);
    expect(properties.reduce((sum, point) => sum + point.count, 0)).toBe(MEASUREMENTS.length);
    expect(properties[0]?.label).toBe("Band gap");
    expect(properties[0]?.count).toBe(3);
  });

  test("returns empty series when there are no papers", () => {
    expect(getPapersByYear([])).toEqual([]);
    expect(getPapersByJournal([])).toEqual([]);
    expect(getMeasurementsByProperty([])).toEqual([]);
  });
});
