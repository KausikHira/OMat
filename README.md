# OMAT-SE — Open Materials Search Engine

A materials knowledge exploration platform integrating composition–property search, interactive visualization, publication-linked retrieval, and agent-based access. Developed as an extension of MatSKRaFT, OMAT-SE makes experimentally reported materials information more accessible for research and materials discovery.

## Platform and Documentation

- **Frontend:** https://omat-kausik-web.vercel.app/
- **Demo video (YouTube):** https://www.youtube.com/watch?v=wFv1wCC3lc8
- **API Reference:** https://omat-se-docs-alpha.vercel.app/api/
- **MCP Reference:** https://omat-se-docs-alpha.vercel.app/mcp/

The deployed interface demonstrates OMAT-SE's search and visualization capabilities using a sample dataset, while the repository supports integration with the full materials knowledge base through its FastAPI and OpenSearch backend. The frontend currently uses mock data for demonstration, with support for full knowledge-base integration through the FastAPI and OpenSearch backend.

## Repository

| Directory | Description |
|---|---|
| `apps/api` | FastAPI service |
| `apps/mcp` | MCP server (Python SDK) |
| `apps/web` | Next.js UI, deployed on Vercel |
| `apps/workers` | Async consumers (phase 2) |
| `packages/` | Shared Python domain, ingestion CLI, typed TypeScript client |
| `data/` | Source CSV, taxonomy, synonyms, staging |
| `infra/` | Terraform and container placeholders |
| `docs/` | Architecture, schema, ADRs, API and MCP reference |
| `report/` | LaTeX write-up |

## Local Setup

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local

just up
just install
just dev-api

bun install
just web-dev
just docs
```

Documentation is available locally at `http://localhost:8080`.

**Requirements:** Python 3.11+, Bun, Docker.

**Additional resources:**
- Architecture: `docs/architecture.md`
- Schema: `docs/schema.md`
- License: MIT

## Deployment

### Frontend

Create a Vercel project with Root Directory `apps/web` and configure `NEXT_PUBLIC_API_URL` in the project environment variables.

Vercel builds using `apps/web/vercel.json`. The installation step runs from the repository root so that the Bun workspace and `bun.lock` are available.

Deployment can be configured through Vercel's Git integration or `.github/workflows/deploy-web.yml` (requiring `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`).

### API and MCP Reference

A separate Vercel project with Root Directory `docs/` publishes the developer documentation:

- `/` — Documentation homepage
- `/api/` — Interactive Scalar API reference
- `/mcp/` — MCP server documentation and integration instructions

The build configuration in `docs/vercel.json` generates `openapi.json` from the FastAPI application during deployment.

Enable **Include files outside the Root Directory in the Build Step** so that the required Python packages are accessible.

The API and MCP references document the implemented interfaces. Executing live API requests requires a separately configured backend.

---

**OMAT-SE** — From scientific literature to searchable materials knowledge.
