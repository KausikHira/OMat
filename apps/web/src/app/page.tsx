import Link from "next/link";

import { SearchForm } from "@/components/search-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { datasetStats } from "@/lib/mock-records";
import { buildSearchHref } from "@/lib/search";

const examples = ["I want to make a house near a riverbed — which type of concrete should I use?"];

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-end px-5 py-5 sm:px-8">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-20 pt-6">
        <div className="w-full max-w-[44rem]">
          <div className="flex flex-col items-center text-center">
            <Wordmark size="lg" />
            <p className="mt-5 max-w-[34rem] text-pretty text-[15px] leading-6 text-muted">
              Search materials data by composition, property, journal, or application.
            </p>
          </div>

          <div className="mt-9">
            <SearchForm autoFocus />
          </div>

          <div className="mt-5 flex flex-col items-center gap-2 text-center text-[13.5px] leading-6 text-muted">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em]">Try</span>
            {examples.map((example) => (
              <Link
                key={example}
                href={buildSearchHref({
                  q: example,
                  elements: [],
                  applications: [],
                  sort: "relevance",
                  tab: "all",
                  page: 1,
                })}
                className="max-w-[30rem] text-pretty text-[15px] font-medium text-ink underline decoration-line-strong decoration-1 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
              >
                “{example}”
              </Link>
            ))}
          </div>

          <p className="mt-14 text-center text-[11px] text-muted">
            {datasetStats.records} measurement records across {datasetStats.journals} journals,{" "}
            {datasetStats.from}–{datasetStats.to}.
          </p>
        </div>
      </main>

      <footer className="flex items-center px-5 py-6 text-[11px] text-muted sm:px-8">
        <a
          href="https://github.com/Jayesh-Dev21/Omat-se"
          target="_blank"
          rel="noreferrer noopener"
          className="transition-colors hover:text-ink hover:underline underline-offset-4"
        >
          OMAT-SE
        </a>
      </footer>
    </div>
  );
}
