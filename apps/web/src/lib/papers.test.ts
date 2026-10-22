import { describe, expect, test } from "bun:test";

import { MEASUREMENTS, type Measurement } from "./mock-records";
import { doiToHref, groupMeasurementsByPaper, normalizeDoi, paginatePapers } from "./papers";

describe("doi helpers", () => {
  test("normalizes DOI URLs and lowercases", () => {
    expect(normalizeDoi(" https://doi.org/10.1016/J.Matlet.2020.129009 ")).toBe(
      "10.1016/j.matlet.2020.129009",
    );
    expect(normalizeDoi("https://dx.doi.org/10.1063/1.4872145")).toBe("10.1063/1.4872145");
  });

  test("only creates links for valid DOIs", () => {
    expect(doiToHref("https://doi.org/10.1016/j.matlet.2020.129009")).toBe(
      "https://doi.org/10.1016/j.matlet.2020.129009",
    );
    expect(doiToHref("10.1063/1.4872145")).toBe("https://doi.org/10.1063/1.4872145");
    expect(doiToHref("not-a-doi")).toBeNull();
  });
});

describe("groupMeasurementsByPaper", () => {
  test("builds one paper per DOI with its metadata", () => {
    const papers = groupMeasurementsByPaper(MEASUREMENTS);
    const uniqueDois = new Set(MEASUREMENTS.map((record) => record.doi));

    expect(papers).toHaveLength(uniqueDois.size);
    expect(papers[0]?.title.length).toBeGreaterThan(0);
    expect(papers[0]?.abstract.length).toBeGreaterThan(0);
    expect(papers[0]?.doiHref).toBe("https://doi.org/10.1016/j.matlet.2020.129009");
  });

  test("merges multiple measurements that share a DOI", () => {
    const first = MEASUREMENTS[0] as Measurement;
    const second: Measurement = {
      ...first,
      id: `${first.id}-hardness`,
      property: { name: "Hardness", slug: "hardness", value: 27.5, unit: "GPa" },
    };

    const papers = groupMeasurementsByPaper([first, second]);

    expect(papers).toHaveLength(1);
    expect(papers[0]?.records).toHaveLength(2);
    expect(papers[0]?.records.map((record) => record.property.slug)).toEqual([
      "youngs-modulus",
      "hardness",
    ]);
  });

  test("papers without an enriched title read as paywalled source", () => {
    const record: Measurement = {
      ...(MEASUREMENTS[0] as Measurement),
      title: undefined,
      abstract: undefined,
      composition: "Al95.89-Cr1.37-N1.37-Ti1.37",
    };

    const papers = groupMeasurementsByPaper([record]);

    expect(papers[0]?.title).toBe("Paywalled source");
  });
});

describe("paginatePapers", () => {
  const papers = groupMeasurementsByPaper(MEASUREMENTS);

  test("returns ten papers on the first page", () => {
    const page = paginatePapers(papers, 1);

    expect(page.items).toHaveLength(10);
    expect(page.totalPages).toBe(2);
    expect(page.start).toBe(1);
    expect(page.end).toBe(10);
  });

  test("returns the remainder on the last page", () => {
    const page = paginatePapers(papers, 2);

    expect(page.items).toHaveLength(papers.length - 10);
    expect(page.start).toBe(11);
    expect(page.end).toBe(papers.length);
  });

  test("clamps pages outside the available range", () => {
    expect(paginatePapers(papers, 99).page).toBe(2);
    expect(paginatePapers(papers, 0).page).toBe(1);
    expect(paginatePapers([], 4)).toMatchObject({
      items: [],
      page: 1,
      totalPages: 1,
      start: 0,
      end: 0,
    });
  });
});
