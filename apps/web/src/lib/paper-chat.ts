import type { PaperGroup } from "@/lib/papers";
import { formatValue } from "@/lib/search";

/**
 * Offline per-paper chat. The live API streams model replies over SSE
 * (POST /v1/papers/{id}/chat); when the API is unreachable the UI answers
 * from the paper's own measurement records only — same scope, same rule:
 * every number cites the record_id it comes from.
 */

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: number;
  role: ChatRole;
  text: string;
  offline?: boolean;
};

function numberFromText(text: string): number | null {
  const match = /(-?\d+(?:[.,]\d+)?)/.exec(text);
  if (!match) {
    return null;
  }
  const value = Number.parseFloat((match[1] ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function recordsForProperty(paper: PaperGroup, propertySlug: string) {
  return paper.records.filter((record) => record.property.slug === propertySlug);
}

function distinctProperties(paper: PaperGroup): string[] {
  const names: string[] = [];
  for (const record of paper.records) {
    if (!names.includes(record.property.name)) {
      names.push(record.property.name);
    }
  }
  return names;
}

function extremeReply(
  paper: PaperGroup,
  propertySlug: string,
  direction: "max" | "min",
): string | null {
  const records = recordsForProperty(paper, propertySlug);
  if (records.length === 0) {
    return null;
  }
  const target = records.reduce((best, record) => {
    if (best === null) {
      return record;
    }
    const bigger = record.property.value > best.property.value;
    if (direction === "max" ? bigger : !bigger && record.property.value !== best.property.value) {
      return record;
    }
    return best;
  }, records[0] ?? null);
  if (!target) {
    return null;
  }
  const word = direction === "max" ? "highest" : "lowest";
  return (
    `The ${word} ${target.property.name.toLowerCase()} in this paper is ` +
    `${formatValue(target.property.value)}${target.property.unit ? ` ${target.property.unit}` : ""} ` +
    `for ${target.composition} (record ${target.id}). ` +
    `That is the extreme across the ${records.length} ${propertySlug.replace(/_/g, " ")} records in this paper.`
  );
}

function compositionReply(paper: PaperGroup, composition: string): string | null {
  const needle = composition.toLowerCase().replace(/[\s_]/g, "");
  const matches = paper.records.filter((record) =>
    record.composition.toLowerCase().replace(/[\s_]/g, "").includes(needle),
  );
  if (matches.length === 0) {
    return null;
  }
  const lines = matches.slice(0, 5).map((record) => {
    const value = `${formatValue(record.property.value)}${record.property.unit ? ` ${record.property.unit}` : ""}`;
    return `• ${record.composition} — ${record.property.name}: ${value} (record ${record.id})`;
  });
  return `Measurements for ${matches[0]?.composition ?? composition} in this paper:\n${lines.join("\n")}`;
}

function greetingReply(paper: PaperGroup): string {
  const properties = distinctProperties(paper);
  const propertyList =
    properties.length > 1
      ? `${properties.slice(0, -1).join(", ")} and ${properties.at(-1)}`
      : (properties[0] ?? "no indexed properties");
  return (
    `I can answer questions about "${paper.title}" from its indexed measurements only. ` +
    `This paper contributes ${paper.records.length} record${paper.records.length === 1 ? "" : "s"} ` +
    `covering ${propertyList}. Try "which composition has the highest value?" or name a composition.`
  );
}

function overviewReply(paper: PaperGroup): string {
  const properties = distinctProperties(paper);
  const lines = properties.map((name) => {
    const records = paper.records.filter((record) => record.property.name === name);
    const values = records.map((record) => record.property.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const unit = records[0]?.property.unit ?? "";
    return (
      `• ${name}: ${records.length} record${records.length === 1 ? "" : "s"}, ` +
      `${formatValue(min)}–${formatValue(max)}${unit ? ` ${unit}` : ""}`
    );
  });
  return (
    `${paper.title} (${paper.journal}, ${paper.year}) has ${paper.records.length} indexed ` +
    `measurements across ${properties.length} propert${properties.length === 1 ? "y" : "ies"}:\n${lines.join("\n")}`
  );
}

/** Slug of the first property whose display name or slug appears in the text. */
function propertyInText(paper: PaperGroup, text: string): string | null {
  for (const record of paper.records) {
    const { name, slug } = record.property;
    if (text.includes(name.toLowerCase()) || text.includes(slug.replace(/_/g, " "))) {
      return slug;
    }
  }
  return null;
}

/** Deterministic reply built from the paper's own records. */
export function offlinePaperReply(paper: PaperGroup, message: string): string {
  const text = message.trim().toLowerCase();
  if (!text) {
    return "Ask me anything about the measurements in this paper.";
  }
  if (/^(hi|hello|hey|help|what can you do)\b/.test(text)) {
    return greetingReply(paper);
  }
  if (/\b(overview|summary|summar\w*|what (does|is) (this|the) paper|properties)\b/.test(text)) {
    return overviewReply(paper);
  }
  const property = propertyInText(paper, text) ?? paper.records[0]?.property.slug ?? "";
  if (/\b(highest|max|most|largest|biggest)\b/.test(text)) {
    const reply = extremeReply(paper, property, "max");
    if (reply) {
      return reply;
    }
  }
  if (/\b(lowest|min|least|smallest)\b/.test(text)) {
    const reply = extremeReply(paper, property, "min");
    if (reply) {
      return reply;
    }
  }
  // Composition lookup: any word that appears in a composition label.
  for (const record of paper.records) {
    for (const token of record.composition.split(/[-–\s]+/)) {
      if (token.length >= 3 && text.includes(token.toLowerCase())) {
        const reply = compositionReply(paper, token);
        if (reply) {
          return reply;
        }
      }
    }
  }
  // Numeric lookup: does any record's value appear in the question?
  const askedNumber = numberFromText(text);
  if (askedNumber !== null) {
    const match = paper.records.find(
      (record) => Math.abs(record.property.value - askedNumber) < 1e-9,
    );
    if (match) {
      return (
        `${formatValue(match.property.value)}${match.property.unit ? ` ${match.property.unit}` : ""} is the ` +
        `${match.property.name.toLowerCase()} of ${match.composition} (record ${match.id}).`
      );
    }
  }
  return `I can only answer from this paper's ${paper.records.length} indexed measurement${paper.records.length === 1 ? "" : "s"}. This dataset has no temperature, method, or full-text content, so I cannot speculate about synthesis or conditions. Try asking about a specific composition or property value.`;
}
