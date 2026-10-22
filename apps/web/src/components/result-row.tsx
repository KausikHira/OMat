import type { Measurement } from "@/lib/mock-records";
import { formatValue } from "@/lib/search";

type ResultRowProps = {
  record: Measurement;
};

export function ResultRow({ record }: ResultRowProps) {
  const visibleAmounts = record.amounts.slice(0, 5);
  const extraAmounts = record.amounts.length - visibleAmounts.length;
  const doiHref = `https://doi.org/${record.doi}`;

  return (
    <li className="border-b border-line py-7 first:pt-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h2 className="font-display text-[1.7rem] font-normal leading-tight tracking-[-0.015em]">
          <a
            href={doiHref}
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-accent"
          >
            {record.composition}
          </a>
        </h2>
        <div className="text-right">
          <p className="text-[1.05rem] font-medium leading-none tabular-nums">
            {formatValue(record.property.value)}
            {record.property.unit ? (
              <span className="ml-1 text-[0.78rem] font-normal text-muted">
                {record.property.unit}
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 text-[11px] text-muted">{record.property.name}</p>
        </div>
      </div>

      <p className="mt-2 text-[13px] text-muted">
        {record.journal}
        {record.year ? `, ${record.year}` : null}
        {record.table !== undefined ? `, Table ${record.table}` : null}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {visibleAmounts.map((amount) => (
          <span
            key={amount.symbol}
            className="inline-flex items-center gap-1 rounded-[3px] border border-line px-1.5 py-0.5 text-[11px] text-muted tabular-nums"
          >
            <span className="font-medium text-ink">{amount.symbol}</span>
            {formatValue(amount.value)}
            <span className="text-[10px]">{amount.unit === "mol" ? "mol%" : "wt%"}</span>
          </span>
        ))}
        {extraAmounts > 0 ? (
          <span className="text-[11px] text-muted">+{extraAmounts} more</span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {record.applications.map((application) => (
          <span key={application.slug} className="inline-flex items-center gap-1.5 text-accent">
            <span aria-hidden="true" className="size-1 rounded-full bg-accent" />
            {application.label}
          </span>
        ))}
        <a
          href={doiHref}
          target="_blank"
          rel="noreferrer noopener"
          className="max-w-full truncate transition-colors hover:text-ink hover:underline"
        >
          doi.org/{record.doi}
        </a>
      </div>
    </li>
  );
}
