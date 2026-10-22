import type { Measurement } from "./mock-records";

export const PAPERS_PER_PAGE = 10;

export type PaperGroup = {
  key: string;
  doi: string;
  doiHref: string | null;
  pii: string;
  title: string;
  abstract: string;
  journal: string;
  journalSlug: string;
  year: number;
  records: Measurement[];
  applications: Measurement["applications"];
};

export type PaperPage = {
  items: PaperGroup[];
  page: number;
  totalPages: number;
  start: number;
  end: number;
};

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;

export function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");
}

export function doiToHref(doi: string): string | null {
  const normalized = normalizeDoi(doi);
  return DOI_PATTERN.test(normalized) ? `https://doi.org/${normalized}` : null;
}

function paperKey(record: Measurement): string {
  const doi = normalizeDoi(record.doi);
  if (doi) {
    return `doi:${doi}`;
  }
  if (record.pii.trim()) {
    return `pii:${record.pii.trim()}`;
  }
  return `record:${record.id}`;
}

export function groupMeasurementsByPaper(measurements: Measurement[]): PaperGroup[] {
  const groups = new Map<string, Measurement[]>();

  for (const record of measurements) {
    const key = paperKey(record);
    const existing = groups.get(key);
    if (existing) {
      existing.push(record);
    } else {
      groups.set(key, [record]);
    }
  }

  return Array.from(groups, ([key, records]) => {
    const first = records[0] as Measurement;
    const doi = normalizeDoi(first.doi);
    const applicationMap = new Map<string, Measurement["applications"][number]>();
    for (const record of records) {
      for (const application of record.applications) {
        applicationMap.set(application.slug, application);
      }
    }
    const title =
      records.find((record) => record.title)?.title ??
      // Papers without an enriched title/abstract come from paywalled
      // sources we have no metadata licence for; say that instead of faking
      // a title from composition labels. The chips below each row already
      // show every composition.
      "Paywalled source";
    const abstract = records.find((record) => record.abstract)?.abstract ?? "";
    const year = records.reduce((latest, record) => Math.max(latest, record.year), 0);

    return {
      key,
      doi,
      doiHref: doi ? doiToHref(doi) : null,
      pii: first.pii,
      title,
      abstract,
      journal: first.journal,
      journalSlug: first.journalSlug,
      year,
      records,
      applications: Array.from(applicationMap.values()),
    };
  });
}

export function paginatePapers(
  papers: PaperGroup[],
  requestedPage: number,
  perPage = PAPERS_PER_PAGE,
): PaperPage {
  const totalPages = Math.max(1, Math.ceil(papers.length / perPage));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), totalPages);
  const offset = (page - 1) * perPage;

  return {
    items: papers.slice(offset, offset + perPage),
    page,
    totalPages,
    start: papers.length === 0 ? 0 : offset + 1,
    end: Math.min(offset + perPage, papers.length),
  };
}
