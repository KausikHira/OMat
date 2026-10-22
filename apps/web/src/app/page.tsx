const planned = [
  {
    label: "Search",
    detail: "BM25 over composition labels, properties, journals, and application groups.",
  },
  {
    label: "Facets",
    detail: "Element, property, journal, application, and year filters with live counts.",
  },
  {
    label: "Records",
    detail: "One document per measured property, grouped by paper and table number.",
  },
  {
    label: "Charts",
    detail: "Plotly distributions and trends fed by cached aggregation endpoints.",
  },
  {
    label: "Chat",
    detail: "Per-paper questions grounded in that paper's measurement rows.",
  },
  {
    label: "MCP",
    detail: "The same domain layer exposed to agents through the Python MCP SDK.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-16 px-6 py-20">
      <header className="flex flex-col gap-5">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-teal-300/80">
          OMAT-SE · skeleton
        </p>
        <h1 className="max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Search materials data by what it is and what it does.
        </h1>
        <p className="max-w-2xl text-pretty text-lg leading-relaxed text-slate-400">
          A faceted search engine over composition and property measurements. The API, ingestion
          pipeline, and index mapping are the next milestone.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2 font-mono text-sm">
          <a
            className="rounded-md bg-teal-300 px-4 py-2 font-medium text-slate-950 transition hover:bg-teal-200"
            href="http://localhost:8000/docs"
          >
            API docs
          </a>
          <span className="rounded-md border border-slate-800 px-4 py-2 text-slate-400">
            GET /healthz
          </span>
        </div>
      </header>

      <section aria-labelledby="planned" className="flex flex-col gap-5">
        <h2 id="planned" className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">
          Planned surface
        </h2>
        <dl className="grid gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-3">
          {planned.map((item) => (
            <div key={item.label} className="flex flex-col gap-2 bg-slate-950/95 p-5">
              <dt className="text-sm font-medium text-slate-200">{item.label}</dt>
              <dd className="text-sm leading-relaxed text-slate-500">{item.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="mt-auto border-t border-slate-800 pt-6 font-mono text-xs text-slate-500">
        Next.js · FastAPI · OpenSearch · Postgres · Redis · Plotly
      </footer>
    </main>
  );
}
