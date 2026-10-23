# Architecture

Status: phase 0 → 1 in progress. The topology and contracts are fixed; the
search path (API + web + MCP) is implemented, and infrastructure work
(Terraform, auth, Kafka) is still ahead.

## Topology

```text
Users
 ├── Vercel ──────────────── Next.js UI (apps/web, SSR)
 ├── GitHub Pages ────────── API reference (Scalar + generated OpenAPI)
 └── Route 53
       ├── api.<domain>          → CloudFront + WAF → ALB → FastAPI (ECS)
       ├── mcp.<domain>          → ALB → MCP server (ECS)
       └── chat.internal.<domain> → Open WebUI (SSO)

FastAPI ── Redis (query cache, rate limits, sessions)
        ├─ OpenSearch (papers_vN behind the `papers` alias)
        ├─ Postgres   (users, saved searches, jobs, chat sessions)
        ├─ S3         (source CSVs, staging JSONL, snapshots)
        └─ Kafka/Redpanda → workers (phase 2)

Ingest: CSV → validate/normalize → JSONL → bulk index → smoke test → alias swap
```

## Layers

| Layer | Responsibility | Current state |
| --- | --- | --- |
| `apps/web` | SSR search and paper pages, Plotly charts, chat panel | Search UI + Plots tab live (see [plots.md](plots.md)); paper/chat pages pending |
| `apps/api` | HTTP validation, auth, caching, response shaping | `/v1/search`, `/facets`, `/suggest`, `/papers`, `/aggregates`, `/literature`, `/chat` live; auth/rate limits pending |
| `packages/py-core` | Models, cleaning, taxonomy, query DSL, GSC chart math | Implemented (see [search.md](search.md)); text enrichment pending |
| `packages/py-ingest` | CSV → validated records → index | CLI implemented |
| `apps/mcp` | Agent-facing tools | `search_records` (with filters), `get_paper`, `facet_counts` (with filters), `suggest`, `props_scatter`, `gsc_chart`, literature tools live |
| `apps/workers` | Async consumers | Idle entry point (phase 2) |
| `docs/api` | Static Scalar reference generated from FastAPI | Shell page + Pages workflow |
| `infra` | Local compose, Terraform skeleton | Compose stack |

The important boundary: **`py-core` owns search semantics**. FastAPI and the MCP
server are adapters. If a query works in the UI, it must work through MCP without
being reimplemented.

## Search request flow

Full semantics: [search.md](search.md). Plots/aggregates: [plots.md](plots.md).

1. The browser (served by Vercel) calls `GET https://api.<domain>/v1/search`
   through CloudFront and the ALB.
2. FastAPI validates parameters with pydantic and checks the Redis cache using a
   key of normalized query string plus index alias version.
3. `py-core` interprets the query first: conversational filler is dropped and
   domain words are mapped through the curated intent lexicon
   (`data/taxonomy/intents.yaml`) to application/property facet boosts plus an
   expanded text query. It then builds the OpenSearch request: `multi_match`
   for text, `bool.filter` for explicit facets, `search_after` for pagination.
4. Hits are normalized, links are derived from DOI values, and the envelope is
   cached for 60 seconds.
5. An anonymized search event is emitted (phase 2) and never stored with an IP.

## Record model

One OpenSearch document is one **measurement property**, not one CSV row and not
one paper. A row with two property tuples produces two documents sharing a
`proxy_id`. Paper pages group by DOI/PII; facet counts stay correct because each
document has a single property value and unit.

## Chat

Per-paper chat reads that paper's records directly. There is no PDF chunk index
and no embedding pipeline in this dataset. Above the context cap the model gets
read-only tools; answers must cite `proxy_id` and table number.

## Deployment target

- Vercel for `apps/web` (Next.js, Root Directory `apps/web`)
- GitHub Pages for the generated API reference
- ECS Fargate for `api`, `mcp`, and later `workers`
- OpenSearch Service in private subnets, two AZs
- RDS Postgres, ElastiCache Redis, S3, ECR, Secrets Manager
- ALB + CloudFront + WAF for the API and MCP only; no web origin on the ALB
- `OMAT_CORS_ORIGINS` must include the Vercel production and preview domains

Kafka is not required for the skeleton. Redpanda runs behind the `async` compose
profile so the team can opt in without slowing local startup.
