import { describe, expect, test } from "bun:test";

import { MEASUREMENTS } from "./mock-records";
import type { SearchState } from "./search";
import {
  buildSearchHref,
  formatValue,
  getFacets,
  parseSearchParams,
  searchMeasurements,
} from "./search";

const empty: SearchState = {
  q: "",
  elements: [],
  applications: [],
  sort: "relevance",
  tab: "all",
  page: 1,
};

describe("parseSearchParams", () => {
  test("normalizes repeated facet params", () => {
    const state = parseSearchParams({
      q: " coatings ",
      element: ["Al", "Ti", "Al"],
      application: "hard-coatings",
      sort: "newest",
    });

    expect(state.q).toBe("coatings");
    expect(state.elements).toEqual(["Al", "Ti"]);
    expect(state.applications).toEqual(["hard-coatings"]);
    expect(state.sort).toBe("newest");
  });

  test("only honors value sorting with a property", () => {
    expect(parseSearchParams({ sort: "value" }).sort).toBe("relevance");
    expect(parseSearchParams({ sort: "value", property: "band-gap" }).sort).toBe("value");
  });

  test("parses result tab and paper page, ignoring invalid values", () => {
    expect(parseSearchParams({ tab: "plots", page: "2" })).toMatchObject({
      tab: "plots",
      page: 2,
    });
    expect(parseSearchParams({ tab: "other", page: "-4" })).toMatchObject({
      tab: "all",
      page: 1,
    });
  });
});

describe("searchMeasurements", () => {
  test("matches a label without the source digits", () => {
    const results = searchMeasurements(MEASUREMENTS, { ...empty, q: "TiAlCrN" });

    expect(results.map((record) => record.composition)).toEqual(["TiAl70CrN"]);
  });

  test("requires all selected elements", () => {
    const results = searchMeasurements(MEASUREMENTS, { ...empty, elements: ["Al", "Ti"] });

    expect(results).toHaveLength(1);
    expect(results[0]?.composition).toBe("TiAl70CrN");
  });

  test("matches any selected application", () => {
    const results = searchMeasurements(MEASUREMENTS, {
      ...empty,
      applications: ["hard-coatings", "batteries"],
    });

    expect(results.map((record) => record.composition).sort()).toEqual(["LiFePO4", "TiN"]);
  });

  test("sorts by year and by measured value", () => {
    const newest = searchMeasurements(MEASUREMENTS, { ...empty, sort: "newest" });
    const highestBandGap = searchMeasurements(MEASUREMENTS, {
      ...empty,
      property: "band-gap",
      sort: "value",
    });

    expect(newest[0]?.year).toBe(2022);
    expect(highestBandGap[0]?.property.value).toBe(3.4);
  });
});

describe("getFacets", () => {
  test("counts elements, applications, properties, and journals", () => {
    const facets = getFacets(MEASUREMENTS);

    expect(facets.elements.find((facet) => facet.value === "Ti")?.count).toBeGreaterThan(1);
    expect(facets.applications.find((facet) => facet.value === "batteries")?.count).toBe(1);
    expect(facets.properties.find((facet) => facet.value === "band-gap")?.count).toBe(3);
    expect(facets.journals.find((facet) => facet.value === "joule")?.label).toBe("Joule");
  });
});

describe("buildSearchHref", () => {
  test("preserves repeated filters and omits the default sort", () => {
    const href = buildSearchHref({
      ...empty,
      q: "coatings",
      elements: ["Ti", "Al"],
      applications: ["hard-coatings"],
      property: "hardness",
      journal: "acta-materialia",
      sort: "newest",
    });

    expect(href).toBe(
      "/search?q=coatings&element=Al&element=Ti&application=hard-coatings&property=hardness&journal=acta-materialia&sort=newest",
    );
  });

  test("returns the bare search route for an empty state", () => {
    expect(buildSearchHref(empty)).toBe("/search");
  });

  test("preserves the active tab and paper page", () => {
    expect(buildSearchHref({ ...empty, q: "coatings", tab: "plots", page: 2 })).toBe(
      "/search?q=coatings&tab=plots&page=2",
    );
  });
});

describe("formatValue", () => {
  test("keeps human-scale numbers plain", () => {
    expect(formatValue(467)).toBe("467");
    expect(formatValue(1.3)).toBe("1.3");
    expect(formatValue(0)).toBe("0");
  });

  test("does not round tiny magnitudes to zero", () => {
    // Real index data: aerogel-like densities around 1e-9 g/cm³.
    expect(formatValue(1.04e-9)).toBe("1.04×10⁻⁹");
    expect(formatValue(4.8e-7)).toBe("4.80×10⁻⁷");
  });

  test("uses scientific notation for huge magnitudes", () => {
    expect(formatValue(4.67e11)).toBe("4.67×10¹¹");
  });

  test("degrades gracefully for non-finite values", () => {
    expect(formatValue(Number.NaN)).toBe("—");
  });
});
