import type { PaperGroup } from "./papers";

export type SeriesPoint = {
  label: string;
  count: number;
};

export type YearPoint = {
  year: number;
  count: number;
};

function sortSeries(points: SeriesPoint[]): SeriesPoint[] {
  return points.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function getPapersByYear(papers: PaperGroup[]): YearPoint[] {
  const counts = new Map<number, number>();

  for (const paper of papers) {
    if (paper.year > 0) {
      counts.set(paper.year, (counts.get(paper.year) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year);
}

export function getPapersByJournal(papers: PaperGroup[]): SeriesPoint[] {
  const counts = new Map<string, number>();

  for (const paper of papers) {
    const label = paper.journal || "Unknown journal";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return sortSeries(Array.from(counts, ([label, count]) => ({ label, count })));
}

export function getMeasurementsByProperty(papers: PaperGroup[]): SeriesPoint[] {
  const counts = new Map<string, number>();

  for (const paper of papers) {
    for (const record of paper.records) {
      const label = record.property.name || "Unknown property";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return sortSeries(Array.from(counts, ([label, count]) => ({ label, count })));
}
