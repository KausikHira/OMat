# Search

How a query travels from the search box to ranked measurement records, and the
contracts every surface (web, API, MCP) shares. `py-core` owns all search
semantics; `apps/api` and `apps/mcp` are thin adapters over the same builders
(`packages/py-core/src/omat_core/opensearch/__init__.py`).

## Query interpretation (natural language → index terms)

A sentence like *"I want to make a house near a riverbed, what type of concrete
should I use"* cannot be answered by a literal BM25 match. Every free-text
`q` is first rewritten by `packages/py-core/src/omat_core/query_interpret.py`:

1. **Filler removal** — conversational tokens ("I want to", "should I use",
   "make", "type") are dropped from the text match. Token casing is preserved
   because the standard tokenizer splits `TiAlN` but not `tialn`.
2. **Intent mapping** — surviving domain words are matched against the
   curated lexicon `data/taxonomy/intents.yaml`:
   - applications: house/riverbed/concrete → `structural-mechanical`,
     battery → `energy`, implant → `biomedical-dental`, …
   - properties: stiff → `youngs_modulus`, lightweight → `density`, …
   - synonyms: concrete → "cement mortar"
   The lexicon is curated data; code never guesses a taxonomy mapping. If the
   file is missing (e.g. a stripped-down deployment), interpretation degrades
   to filler removal only.
3. **Query shape** — the cleaned text goes into a `multi_match` over
   `title^4`, `composition.label^3`, `composition.canonical^3`,
   `search_text^3`, `applications.raw^2`, `property.name^2`, `abstract^1`
   with `operator: or`. Intent hits become **boosted `should` clauses**
   (`term` on `applications.slug` / `property.slug`, boost 8), never hard
   filters — a question must not AND out records that only match the text.

Technical queries pass through untouched: `interpret_query("TiAl70CrN B2O3")`
changes nothing and fires no facets.

## Filters, sorting, pagination

- Filters are term-level `bool.filter` clauses: **OR within a field, AND
  across fields**. Available filter fields: `elements`, `property` (+ `min`/
  `max` numeric range on `property.value_si`), `journal`, `app`, `year_from`/
  `year_to`. DOI/PII lookups use the paper endpoint.
- Sort options: `relevance` (default), `year_desc`, `year_asc`, `value_asc`,
  `value_desc` (value sorts require a `property`).
- Pagination is cursor-based (`search_after` + opaque base64 cursor). Deep
  paging via `from`/`size` is never used. `total` is capped at 10,000.

## Endpoints

| Route | Purpose |
| --- | --- |
| `GET /v1/search` | One page of measurement records (`q`, filters, `sort`, `cursor`, `limit` ≤ 100) |
| `GET /v1/facets` | Aggregation-only counts for the facet rail |
| `GET /v1/suggest` | Prefix autocomplete (compositions, elements, properties, journals) |
| `GET /v1/papers/{id_or_doi}` | All records for one paper (DOI or PII) |
| `GET /v1/aggregates` | Chart data (see [plots.md](plots.md)) |
| `GET /v1/literature/search` | External semantic search over arXiv (Valency) — separate corpus (`q`, `limit`) |
| `GET /v1/literature/trends` | Keyword publication trends via Valency (`keyword`, optional `category`) |
| `GET /v1/literature/related` | Related preprints from semantic + title matches (`q`, `limit`) |
| `POST /v1/papers/{id_or_doi}/chat` | Per-paper Gemini chat over SSE; context is that paper's records |
| `GET /healthz` | Liveness (`/health` is an alias for probes) |

There is no application authentication. Admin ingest routes are local operator
tools; do not expose them through public ingress.

The MCP server (`apps/mcp`) exposes the same semantics as tools by importing
the same py-core builders, so an agent search and a UI search cannot drift. The
published reference lives at `/mcp/` (source: `docs/mcp/index.html`):

| Tool | Mirrors |
| --- | --- |
| `search_records` (with `journal`/`applications` filters) | `GET /v1/search` |
| `get_paper` | `GET /v1/papers/{id}` |
| `facet_counts` (with query + filters) | `GET /v1/facets` |
| `suggest` | `GET /v1/suggest` |
| `props_scatter` (three-property notebook chart with criteria) | `GET /v1/aggregates?kind=props_scatter` |
| `gsc_chart` (composition-family hulls) | `GET /v1/aggregates?kind=gsc` |
| `search_literature`, `literature_trends` | `GET /v1/literature` (Valency) |

The bounded `search_after` scans behind `props_scatter`/`gsc_chart` share the
hit-reduction function with the API (`omat_core.gsc.gsc_row_from_source`), so
both surfaces reduce documents identically.

## Response envelope and caching

```json
{ "data": [], "total": 12400, "took_ms": 12, "cursor": "opaque-base64" }
```

Search responses contain `data`, `total`, `took_ms`, and `cursor`; facet counts
come from the separate `GET /v1/facets` endpoint. `facets` and `index_version`
are not embedded in the search response.

First-page queries are cached in Redis for 60 s keyed on the normalized query
parameters. Alias swaps do not purge that cache, so a reindex can leave up to
60 s of stale results. Web requests time out after 10 s and fall back to mock
records, so a wedged API worker cannot stall server rendering.

## Examples

```bash
# Natural-language question → structural concrete records
curl "$API/v1/search?q=I+want+to+build+a+house+near+a+riverbed"

# Technical query with filters and a value range
curl "$API/v1/search?q=TiAlN&property=hardness&min=20&max=40&elements=Ti,Al"
```
