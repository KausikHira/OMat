# ADR 0001: stack and data model

- Status: accepted
- Date: 2026-10-23

## Context

The corpus is a CSV of materials measurements, not full papers. Every row links a
paper (DOI/PII) to a composition, one or more property measurements, a journal,
table references, and an application group. The primary use case is faceted search
with charts, plus a chat panel for a single paper.

## Decisions

1. **OpenSearch 2.x is the search engine.** BM25, aggregations, and a numeric
   kNN field cover the product without adding a vector database. Managed service
   in AWS, single node locally.
2. **One document per measurement property.** Rows with multiple property tuples
   are exploded at ingest. This keeps facets, range filters, and value sorting
   cheap. `proxy_id` regroups documents for display.
3. **Raw values are preserved.** Every normalized field sits next to the original
   source string. Cleaning never destroys evidence.
4. **Python owns the domain.** `packages/py-core` is imported by the API, MCP
   server, workers, and ingestion CLI. Search semantics cannot drift between
   surfaces.
5. **pip + editable packages for Python, Bun workspaces for TypeScript.** No
   private package registry. Local packages install with `-e`, and the OpenAPI
   schema generates the TypeScript client.
6. **Kafka is deferred to phase 2.** At this corpus size, a CLI ingestion job is
   simpler and observable. The worker entry point exists so the queue can be
   added without restructuring. Redpanda is the local broker and MSK Serverless
   or Redpanda Cloud the deployed one.
7. **Per-paper chat does not use RAG.** The paper's rows fit in context, or fit
   behind read-only tools. No chunk index, no embeddings, no PDF pipeline.
8. **Next.js renders on the server.** Search and paper pages are public and
   linkable; SSR plus stable URLs are better for discovery than a pure SPA.
9. **Composition similarity uses a 118-dim vector.** Periodic-table ordering
   makes Euclidean distance meaningful and avoids text embeddings for chemistry.
10. **The web app deploys on Vercel; the API deploys on AWS.** The Next.js
    frontend has no server-side dependency on the VPC, and Vercel's preview
    deployments are useful for UI review. API, MCP, and workers stay on ECS
    Fargate next to OpenSearch. The API reference is generated from FastAPI and
    published to GitHub Pages.

## Consequences

- Reindexing requires a new `papers_vN` index and an alias swap. Cache keys must
  include the index version.
- Unit and property taxonomies become operational data that must be reviewed, not
  code that silently guesses.
- The chat endpoint can only answer from the columns present. It must refuse
  questions about measurement conditions that the dataset does not contain.
- Kafka stays out until there is a consumer that genuinely needs replay.
- `OMAT_CORS_ORIGINS` must list the Vercel production and preview domains.
- API docs can drift if the schema changes without a deploy; the docs workflow
  regenerates them on every API change.
