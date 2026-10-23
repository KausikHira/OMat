# Architecture

Status: search, ingestion, web, and MCP are implemented for local use. AWS
infrastructure and async workers remain ahead.

The corpus is public and read-only. There is no application authentication,
accounts, or session state; admin ingest is a local operator path and must stay
off public ingress.

## Topology

```text
Users
 ├── Vercel ──────────────── Next.js UI (apps/web, SSR) + docs site (docs/)
 └── Route 53
       ├── api.<domain>          → CloudFront + WAF → ALB → FastAPI (ECS)
       └── mcp.<domain>          → ALB → MCP server (ECS)

FastAPI ── Redis (query cache; rate limits planned)
        ├─ OpenSearch (papers_vN behind the `papers` alias)
        ├─ Postgres   (jobs and operational metadata)
        ├─ S3         (source CSVs, staging JSONL, snapshots)
        └─ Kafka/Redpanda → workers (phase 2)

Ingest: CSV → validate/normalize → JSONL → bulk index → alias swap
```

## Layers

| Layer | Responsibility | Current state |
| --- | --- | --- |
| `apps/web` | SSR search page, inline SVG charts, per-paper chat drawer | Search, Plots, and chat implemented (see [plots.md](plots.md)); the live demo falls back to mock records without an API |
| `apps/api` | HTTP validation, caching, response shaping | `/v1/search`, `/facets`, `/suggest`, `/papers`, `/aggregates`, `/literature`, `/chat` implemented; local admin ingest; rate limiting pending |
| `packages/py-core` | Models, cleaning, taxonomy, query DSL, GSC chart math | Implemented (see [search.md](search.md)); title enrichment implemented, abstract enrichment optional |
| `packages/py-ingest` | CSV → validated records → index | CLI implemented (`validate`, `index`, `report`) |
| `apps/mcp` | Agent-facing tools | `search_records`, `get_paper`, `facet_counts`, `suggest`, `props_scatter`, `gsc_chart`, literature tools implemented |
| `apps/workers` | Async consumers | Idle entry point (phase 2) |
| `docs/` | Developer docs site: Scalar API reference + MCP tool reference | `/`, `/api`, `/mcp` published by Vercel Git integration (Root Directory `docs/`) |
| `infra` | Terraform and container placeholders | Root Docker Compose; AWS not provisioned |

The important boundary: **`py-core` owns search semantics**. FastAPI and the MCP
server are adapters. If a query works in the UI, it must work through MCP without
being reimplemented.

## Search request flow

Full semantics: [search.md](search.md). Plots/aggregates: [plots.md](plots.md).

1. The browser (served by Vercel) calls `GET https://api.<domain>/v1/search`
   through CloudFront and the ALB.
2. FastAPI validates parameters and checks the Redis cache using a key of
   normalized query parameters. First-page results cache for 60 s; alias swaps do
   not purge the cache.
3. `py-core` interprets the query first: conversational filler is dropped and
   domain words are mapped through the curated intent lexicon
   (`data/taxonomy/intents.yaml`) to application/property facet boosts plus an
   expanded text query. It then builds the OpenSearch request: `multi_match`
   for text, `bool.filter` for explicit facets, `search_after` for pagination.
4. Hits are returned as stored source documents; the UI derives display links
   from DOI values. The response is cached for 60 seconds.
5. An anonymized search event is emitted (phase 2) and never stored with an IP.

## Record model

One OpenSearch document is one **measurement property**, not one paper. The
current CSV has one property tuple per row, so each valid row becomes one
document; composition-only rows are kept with `has_property: false`. `record_id`
is a stable hash of PII, DOI, and source row index. The web groups documents by
DOI/PII for display; facet counts stay correct because each document has a single
property value and unit.

## Chat

Per-paper chat reads that paper's records directly. There is no PDF chunk index
and no embedding pipeline in this dataset. The model may call one read-only
external-literature tool; numeric claims must cite `record_id`. Table numbers are
not in the source and must not be invented.

## Deployment target

- Vercel for `apps/web` (Next.js, Root Directory `apps/web`) and for `docs/`
  (static reference, Root Directory `docs/`)
- ECS Fargate for `api`, `mcp`, and later `workers`
- OpenSearch Service in private subnets, two AZs
- RDS Postgres, ElastiCache Redis, S3, ECR, Secrets Manager
- ALB + CloudFront + WAF for the API and MCP only; no web origin on the ALB
- Admin ingest is local-only; do not route `/v1/admin` through public ingress
- `OMAT_CORS_ORIGINS` must include the Vercel production and preview domains

Kafka is not required for v1. Redpanda runs behind the `async` compose profile so
the team can opt in without slowing local startup.
