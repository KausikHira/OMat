# ADR 0002: docs site publishes through Vercel, not GitHub Pages

- Status: accepted
- Date: 2026-10-23

## Context

ADR 0001 decided that the generated API and MCP reference is published to
GitHub Pages by `.github/workflows/docs.yml`. The web app already deploys on
Vercel, so the docs site was the only thing on a second hosting provider, and
its Pages workflow duplicated the build steps (install API packages, generate
`openapi.json`, assemble `_site/`). The GitHub repository for this project
moved to a different account, and Pages was never enabled there, so the docs
site had no live deployment at all.

## Decision

Publish `docs/` through Vercel's Git integration as a second project:

- **Root Directory**: `docs/`, with "Include files outside the Root Directory"
  enabled so the build can reach `packages/py-core` and `apps/api` (the same
  setting `apps/web` already relies on).
- **Build**: `docs/vercel.json` installs the two API packages editable and
  regenerates `docs/api/openapi.json` from the FastAPI app, then serves the
  directory as a static site (`/`, `/api/`, `/mcp/`).
- `.github/workflows/docs.yml` is deleted. `ci.yml` keeps the OpenAPI schema
  check, so a broken schema still fails before merge; the publish step is now
  Vercel's responsibility and re-runs on every push that changes the repo.

## Consequences

- One provider (Vercel) hosts both the web app and the reference site; there
  is no GitHub Pages enablement step to forget.
- `openapi.json` is still never hand-edited or committed; it is regenerated on
  every Vercel build, so the published schema tracks the FastAPI models.
- The docs project must keep "Include files outside the Root Directory"
  enabled, or the pip install of the local packages fails at build time.
- Preview deployments are available for pull requests touching the docs or the
  API surface, which Pages did not provide.
