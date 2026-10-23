# AGENTS.md

Instructions for AI coding agents working in this repository. Read this file before
editing. The contracts in `docs/` are authoritative. The search path, ingest CLI,
web UI, and MCP tools are implemented; deployment and operations work is ongoing.

## Read first

1. `docs/architecture.md` — topology, service boundaries, deployment target
2. `docs/schema.md` — source columns, canonical record, index fields, validation rules
3. `docs/search.md` — query semantics, endpoints, and MCP tools
4. `docs/plots.md` — aggregate charts and rendering rules
5. `docs/adr/0001-stack-and-data-model.md` — decisions that must not be silently changed
6. `README` — layout and local commands

If a task conflicts with those documents, stop and ask rather than inventing a new
contract.

## What this project is

A faceted search engine over materials measurements. Each source row links a paper
(DOI / Article PII) to an elemental composition, one or more measured properties, a
journal, table references, and an application group.

It is not a paper search engine and not a PDF RAG system. The primary entity is the
measurement record, grouped by paper for display.

The corpus is public and read-only. There is **no application authentication**, no
user accounts, and no sessions; do not add auth unless the product spec changes.

## Repository map

```text
apps/api/              FastAPI service (omat_api)
apps/mcp/              MCP server using the Python SDK (omat_mcp)
apps/web/              Next.js App Router UI (@omat/web), deployed on Vercel
apps/workers/          Kafka consumers, phase 2 (omat_workers)
packages/py-core/      Domain models, cleaning, taxonomy, OpenSearch DSL (omat_core)
packages/py-ingest/    CSV validation/indexing CLI (omat_ingest)
packages/api-client/   Typed TypeScript client for the FastAPI API
data/                  Source CSV, taxonomy, synonyms, staging, rejects
docs/                  Architecture, schema, ADRs, generated API reference
infra/                 Terraform and container placeholders
report/                LaTeX write-up
```

## Golden rules

1. **`py-core` owns search semantics.** API, MCP, workers, and the ingest CLI must
   delegate to `omat_core`. Never duplicate query DSL, normalization, or taxonomy
   logic in a service.
2. **One OpenSearch document = one measurement property.** The current CSV has
   one property tuple per row, so each valid row becomes one document.
   Composition-only rows are kept with `has_property: false`. Do not index one
   document per paper.
3. **Preserve raw values.** Every normalized field sits next to its source string.
   Cleaning must never destroy evidence.
4. **Source cells are Python literals.** Parse them with `ast.literal_eval`, never
   regex, `eval`, or `exec`. Cap input length before parsing.
5. **`Composition` is a label, not a stoichiometric formula.** The elemental amounts
   in the cell are the truth (`TiAl70CrN` can contain 95.89 mol% Al).
6. **`APL_Group` is the application taxonomy.** DOI is the link source; derive
   display links from it and never trust stored URLs.
7. **OpenSearch is never public.** All access goes through FastAPI or the MCP server.
8. **No Kafka in v1.** Ingestion runs as a CLI job. Add consumers only when a task
   explicitly moves the project to phase 2.
9. **Per-paper chat has no RAG pipeline.** Context is the paper's records, not PDF
   chunks. Do not add embeddings or a vector database without an ADR.
10. **Contracts before code.** Schema, response envelope, and route changes require a
    docs update and a test.
11. **No application auth.** Do not add login, sessions, or user accounts.
    External service tokens (Gemini, Valency) stay server-side. Admin/ingest routes
    are local operator tools and must stay off public ingress.

## Environment

- Python **3.11+** (3.12 is used in CI and Docker)
- Bun **1.2+** (1.4.x is the current local version)
- Docker + Docker Compose
- LaTeX only for `report/`

`python3` on macOS may be 3.9 and is not sufficient. `just install` uses `python3.12`
by default; override with `PYTHON=python3.11 just install`.

Copy environment files:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

## Commands

| Task | Command |
| --- | --- |
| Start local data services | `just up` |
| Start with Redpanda (phase 2) | `just up-async` |
| Stop services | `just down` |
| Install Python workspace | `just install` |
| Run API | `just dev-api` |
| Run MCP server | `just dev-mcp` |
| Ingest CSV | `just index data/final_data.csv` |
| Python tests | `just test` |
| Python lint | `just lint` |
| Python format + fix | `just fmt` |
| Install TS workspace | `bun install` |
| Run web app | `just web-dev` |
| TS lint | `bun run lint` |
| TS typecheck | `bun run typecheck` |
| TS production build | `bun run build` |
| Regenerate OpenAPI file | `just openapi` |
| Serve API docs locally | `just docs` |
| Build LaTeX report | `just report` |

Python dependencies belong in the relevant package's `pyproject.toml`. The root
`requirements.txt` only installs the local packages editable; do not add third-party
dependencies there.

## Python standards

- Ruff is the formatter and linter: line length 100, rules `E,F,I,UP,B,SIM`.
- Use type hints on public functions and pydantic v2 for boundaries.
- Use `src/` layout and absolute imports (`from omat_core...`).
- Raise specific exceptions; do not return `None` to signal a failure.
- Log with the standard library or structured logging. Never log prompts, API keys,
  full `.env` values, or raw source rows containing secrets.
- Keep I/O out of pure normalization functions so they remain testable.
- Prefer `pathlib.Path` over string paths.
- Do not add a dependency for something the standard library already does.

## TypeScript standards

- TypeScript is strict with `noUncheckedIndexedAccess`. Do not weaken it.
- Next.js App Router; server components by default. Add `"use client"` only where
  browser APIs or state require it.
- Charts are inline SVG rendered on the server. Do not add Plotly or another chart
  library; keep chart math in pure, tested functions.
- Interactive charts are fed by aggregate endpoints; static summaries are computed
  server-side, never in the browser.
- Use `nuqs` for filter state so searches are shareable and back/forward works.
- Use TanStack Query for client fetching; server components fetch directly.
- Keep API response types in `@omat/api-client`. Run `bun run gen:api` to refresh
  `schema.d.ts` after OpenAPI changes; do not define API response types in components.
- Virtualize long tables. Do not render 10k rows.
- Keep accessibility: labels on inputs, keyboard navigation, visible focus states.

## API conventions

- All public routes live under `/v1`.
- Search responses: `{ data, total, took_ms, cursor }`. Facets come from
  `/v1/facets`; they are not embedded in the search response.
- Pagination is cursor-based (`search_after`), never `from`/`size` deep paging.
- Filter semantics: OR within a field, AND across fields.
- Cache keys include normalized query parameters. First-page search results cache
  for 60 s, so an alias swap can leave at most 60 s of stale results.
- Return typed pydantic response models; do not return raw OpenSearch hits.
- Derive links from DOI values; do not trust stored URLs blindly.
- Use SSE for chat streaming and set the ALB idle timeout above the stream duration.
- Errors: stable machine-readable codes, no stack traces or internal hostnames.
- There is no auth middleware. Admin/ingest routes are local operator paths and must
  not be exposed through public ingress.

## Data and search rules

- Read `docs/schema.md` before touching parsing, mappings, or facets.
- Normalize DOI to lowercase, strip `https://doi.org/`; validate
  `^10\.\d{4,9}/\S+$`.
- `Article PII` is a Publisher Item Identifier, not personal data. Use
  `article_pii`.
- Check that the `Elements` set matches the atoms expanded from `Composition`;
  mismatches are warnings, not silent rewrites.
- Convert `wt%` to at% before building the composition vector; `mol%` is already at%.
- Keep `record_id` stable. It is derived from PII + DOI + source row index and
  identifies one measurement property; paper display groups by DOI/PII.
- Reject bad rows to `data/rejects/` with a reason; never silently drop them.
- Taxonomies (`properties`, `units`, `journals`, `applications`) are curated data.
  Propose changes explicitly; do not let code guess a mapping.
- Index changes require a new `papers_vN` index and an alias swap, never an in-place
  destructive mapping change.

## Testing

- Add pytest coverage for every new parser, query builder, and endpoint.
- Put API tests under `apps/api/tests/`; package tests under the package's `tests/`.
- Use FastAPI `TestClient` for routes; do not require a live OpenSearch for unit
  tests. Mock or fake the client.
- Include fixture rows with dirty input: empty property, wt%, empty application
  groups, duplicate rows, and bad DOIs.
- A bug fix needs a regression test.
- Web unit tests live under `apps/web/src/lib/*.test.ts` and run with
  `cd apps/web && bun test`. There is no browser test runner; do not add one
  without discussing it.

### No DOM screenshots

Never use Playwright, Puppeteer, Selenium, headless Chrome, or any other tool
to render pages or capture DOM screenshots in this repository — not for
verification, not for debugging, not for report figures. This applies even if
a dependency happens to be installed.

If a visual check is genuinely required:

1. Ask the user to provide the screenshot and wait for it.
2. If the user cannot provide one, fall back to the minimal alternative:
   assert on rendered HTML/markup strings, component logic, or API responses
   with unit tests, and state explicitly in the response that visual
   verification was skipped and why.

## Quality gates before committing

```bash
just lint
just fmt
just test
bun run lint
bun run typecheck
bun run build
cd apps/web && bun test
```

All seven must pass. CI runs the Python lint/tests/OpenAPI check and the web
typecheck/build; a green local run avoids a broken push.

## Git rules

- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`,
  `ci:`.
- Keep commits scoped and explain the *why* in the body when the change is not obvious.
- Commit `bun.lock`. Never commit `package-lock.json`, `yarn.lock`, `node_modules`,
  `.next`, `.turbo`, `.vercel`, `.venv`, `__pycache__`, or `docs/api/openapi.json`.
- Never commit `.env`, real source CSVs, or generated report PDFs.
- Do not amend commits that have already been pushed. If history must be rewritten
  on a private branch, use `git push --force-with-lease`; never force-push `main`/
  `master` without explicit approval.
- Do not use `git add -A` blindly; inspect `git status` first.

## CI/CD and deployment

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/ci.yml` | push to main/master, PRs, manual | Ruff, pytest, OpenAPI check, Bun typecheck/build |
| `.github/workflows/deploy-web.yml` | web-related pushes to main/master, manual | Vercel production deploy via CLI |
| `.github/workflows/docs.yml` | API-related pushes to main/master, manual | Generate OpenAPI and publish to GitHub Pages |

### Vercel (web)

- Vercel project **Root Directory**: `apps/web`.
- Config lives in `apps/web/vercel.json`; do not move it to the repo root.
- Set `NEXT_PUBLIC_API_URL` in Vercel project settings, not in the repository.
  Without it the live site falls back to the bundled mock records.
- Vercel auto-detects Bun from the root `bun.lock`.
- Use **either** Vercel Git integration **or** `deploy-web.yml`, not both.
- Required workflow secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Add the deployed Vercel domain (and preview domains) to `OMAT_CORS_ORIGINS`.

### API docs (GitHub Pages)

- Repository **Settings → Pages → Source: GitHub Actions**.
- `docs/api/index.html` is the Scalar shell; the spec is generated from FastAPI.
- Never hand-edit `openapi.json`; change the pydantic/FastAPI models instead.
- Local preview: `just docs`.

### AWS (backend)

- Not provisioned yet. Add infrastructure only under `infra/terraform/`; do not make
  console-only changes.
- Target: ECS Fargate for `api`, `mcp`, `workers`; OpenSearch in private subnets;
  RDS Postgres; ElastiCache Redis; S3; ECR; Secrets Manager.
- ALB + CloudFront + WAF front the API and MCP only. The web app is on Vercel.
- Local compose disables the OpenSearch security plugin. Never copy that setting to
  a deployed environment.
- Never commit AWS keys. Use GitHub OIDC roles and repository secrets.
- Do not add a CI deploy workflow for AWS until the Terraform stack and ECS service
  names exist; a workflow that rebuilds the old task definition is worse than none.

## Security

- Never commit secrets, `.env` files, API keys, or source datasets.
- Treat every CSV cell as untrusted input: cap lengths, validate identifiers, and
  never interpolate values into query strings.
- Do not expose OpenSearch, Postgres, Redis, or MinIO publicly.
- Sanitize DOI-derived links; do not fetch arbitrary URLs from user input (SSRF).
- Chat prompts must not allow arbitrary tool calls or URL fetching. The model may
  only read records for the selected paper and must cite `record_id` for every
  numeric claim. Table numbers are not in the source; never invent them.
- Do not log chat prompts, model responses, or API keys.
- Keep CORS an explicit allowlist; do not enable credentialed CORS or `*`.

## Known gaps

- The public backend is not deployed. The Vercel frontend falls back to bundled
  mock records until `NEXT_PUBLIC_API_URL` points at a reachable API.
- AWS infrastructure is not provisioned: `infra/terraform` and `infra/docker` are
  placeholders; no ECS task definitions or Dockerfiles exist.
- Rate limiting and search-event analytics are not implemented.
- Admin/ingest routes have no auth and are not network-restricted; keep them off
  public ingress.
- Kafka/Redpanda is opt-in and has no consumers (phase 2).
- Generated OpenAPI TypeScript types are not checked in; `@omat/api-client`
  currently mirrors the FastAPI response shapes by hand.
- Python 3.12 is required but may not be installed on the local machine.

## Definition of done

- [ ] Change matches `docs/architecture.md` and `docs/schema.md`
- [ ] Domain logic lives in `py-core`, not duplicated in adapters
- [ ] Tests added or updated; `just test` passes
- [ ] `just lint` and `just fmt` pass
- [ ] `bun run lint`, `bun run typecheck`, and `bun run build` pass
- [ ] Docs updated if a contract, route, or deployment changed
- [ ] No secrets, generated artifacts, or raw data staged
- [ ] Commit message follows the convention

If a requirement is ambiguous, ask a focused question instead of guessing. The data
model is the expensive thing to change later.
