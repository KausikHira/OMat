import type { PaperGroup } from "@/lib/papers";
import { formatValue } from "@/lib/search";

import { PaperChat } from "./paper-chat";

type PaperRowProps = {
  paper: PaperGroup;
};

export function PaperRow({ paper }: PaperRowProps) {
  const count = paper.records.length;
  const meta = [
    paper.journal,
    paper.year > 0 ? String(paper.year) : null,
    `${count} measurement${count === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const abstract =
    paper.abstract ||
    `Abstract not indexed for this paper yet. It contributes ${count} measurement record${
      count === 1 ? "" : "s"
    } to OMAT-SE.`;

  return (
    <li className="border-b border-line py-8 first:pt-1">
      <article>
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted">{meta}</p>
            <h2 className="mt-2 max-w-[42rem] text-pretty font-display text-[1.6rem] font-normal leading-[1.2] tracking-[-0.015em]">
              {paper.doiHref ? (
                <a
                  href={paper.doiHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="transition-colors hover:text-accent"
                >
                  {paper.title}
                </a>
              ) : (
                paper.title
              )}
            </h2>
          </div>

          <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
            {paper.doiHref ? (
              <a
                href={paper.doiHref}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[11px] text-accent underline decoration-accent/40 underline-offset-4 transition-colors hover:decoration-accent"
              >
                Read paper ↗
              </a>
            ) : null}
            <PaperChat paper={paper} />
          </div>
        </div>

        <p
          className={`mt-3 max-w-[70ch] text-pretty text-[13px] leading-6 ${
            paper.abstract ? "text-muted" : "italic text-muted"
          }`}
        >
          {abstract}
        </p>

        <ul className="mt-4 flex flex-wrap gap-2">
          {paper.records.map((record) => {
            const hasComposition = record.composition.trim().length > 0;
            const hasProperty = record.property.name.trim().length > 0;
            if (!hasComposition && !hasProperty) return null;
            return (
              <li
                key={record.id}
                className="inline-flex flex-wrap items-baseline gap-x-1.5 rounded-[4px] border border-line px-2 py-1 text-[11px]"
              >
                {hasComposition ? (
                  <span className="font-medium text-ink">{record.composition}</span>
                ) : null}
                {hasProperty ? (
                  <>
                    <span className="text-muted">{record.property.name}</span>
                    <span className="font-medium text-ink tabular-nums">
                      {formatValue(record.property.value)}
                      {record.property.unit ? (
                        <span className="ml-0.5 font-normal text-muted">
                          {record.property.unit}
                        </span>
                      ) : null}
                    </span>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          {paper.applications.map((application) => (
            <span key={application.slug} className="inline-flex items-center gap-1.5 text-accent">
              <span aria-hidden="true" className="size-1 rounded-full bg-accent" />
              {application.label}
            </span>
          ))}
          {paper.doiHref ? (
            <a
              href={paper.doiHref}
              target="_blank"
              rel="noreferrer noopener"
              className="max-w-full truncate transition-colors hover:text-ink hover:underline"
            >
              doi.org/{paper.doi}
            </a>
          ) : paper.doi ? (
            <span className="max-w-full truncate">{paper.doi}</span>
          ) : null}
        </div>
      </article>
    </li>
  );
}
