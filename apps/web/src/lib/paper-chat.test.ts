import { describe, expect, test } from "bun:test";

import { MEASUREMENTS, type Measurement } from "./mock-records";
import { offlinePaperReply } from "./paper-chat";
import { type PaperGroup, groupMeasurementsByPaper } from "./papers";

const base = MEASUREMENTS[0] as Measurement;

const paper = groupMeasurementsByPaper([
  {
    ...base,
    id: "glass-a-density",
    composition: "GlassA",
    property: { name: "Density", slug: "density", value: 2.5, unit: "g/cm³" },
  },
  {
    ...base,
    id: "glass-b-density",
    composition: "GlassB",
    property: { name: "Density", slug: "density", value: 4.1, unit: "g/cm³" },
  },
  {
    ...base,
    id: "glass-a-hardness",
    composition: "GlassA",
    property: { name: "Hardness", slug: "hardness", value: 6.2, unit: "GPa" },
  },
])[0] as PaperGroup;

describe("offlinePaperReply", () => {
  test("greets with the paper's record count and properties", () => {
    const reply = offlinePaperReply(paper, "hello");

    expect(reply).toContain("3 records");
    expect(reply).toContain("Density");
    expect(reply).toContain("Hardness");
  });

  test("finds the highest value and cites the record id", () => {
    const reply = offlinePaperReply(paper, "Which composition has the highest density?");

    expect(reply).toContain("4.1");
    expect(reply).toContain("GlassB");
    expect(reply).toContain("glass-b-density");
  });

  test("finds the lowest value and cites the record id", () => {
    const reply = offlinePaperReply(paper, "Which density is the lowest?");

    expect(reply).toContain("2.5");
    expect(reply).toContain("GlassA");
    expect(reply).toContain("glass-a-density");
  });

  test("reads the property name for a minimum question", () => {
    const reply = offlinePaperReply(paper, "Which hardness is the lowest?");

    expect(reply).toContain("6.2");
    expect(reply).toContain("glass-a-hardness");
  });

  test("lists every measurement for a named composition", () => {
    const reply = offlinePaperReply(paper, "Tell me about GlassA");

    expect(reply).toContain("Density: 2.5 g/cm³ (record glass-a-density)");
    expect(reply).toContain("Hardness: 6.2 GPa (record glass-a-hardness)");
  });

  test("summarizes properties with their value ranges", () => {
    const reply = offlinePaperReply(paper, "Summarize this paper");

    expect(reply).toContain("Density: 2 records, 2.5–4.1 g/cm³");
    expect(reply).toContain("Hardness: 1 record, 6.2–6.2 GPa");
  });

  test("refuses questions outside the indexed records", () => {
    const reply = offlinePaperReply(paper, "What synthesis temperature did they use?");

    expect(reply).toContain("only answer from this paper's 3 indexed measurements");
    expect(reply).toContain("no temperature, method, or full-text");
  });
});
