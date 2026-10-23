set shell := ["bash", "-cu"]

python_bin := env_var_or_default("PYTHON", "python3.12")
venv := ".venv"
python := venv + "/bin/python"
pip := venv + "/bin/pip"

default:
    @just --list

# --- Python -----------------------------------------------------------------

venv:
    {{python_bin}} -m venv {{venv}}

install: venv
    {{pip}} install -U pip
    {{pip}} install -r requirements-dev.txt

dev-api:
    {{python}} -m uvicorn omat_api.main:app --reload --port 8000

dev-mcp:
    {{python}} -m omat_mcp.server

index path="data/final_data.csv":
    {{python}} -m omat_ingest.cli index {{path}}

test:
    {{python}} -m pytest

lint:
    {{python}} -m ruff check apps packages

fmt:
    {{python}} -m ruff format apps packages
    {{python}} -m ruff check --fix apps packages

# --- Local infrastructure ----------------------------------------------------

up:
    docker compose up -d

up-async:
    docker compose --profile async up -d

down:
    docker compose down

logs:
    docker compose logs -f --tail=100

ps:
    docker compose ps

# --- TypeScript --------------------------------------------------------------

web-install:
    bun install

# Stop the web dev server, wipe the Next.js dev cache, restart clean.
# Run this after bun add/remove or when pages 500 with
# "Cannot find module './NNN.js'" in the dev log.
web-fresh:
    pkill -f "next dev" || true
    pkill -f "next-server" || true
    sleep 1
    rm -rf apps/web/.next
    just web-dev

web-dev:
    bun run dev

web-build:
    bun run build

typecheck:
    bun run typecheck

# --- API docs ----------------------------------------------------------------

openapi:
    {{python}} -c "import json; from omat_api.main import app; print(json.dumps(app.openapi(), indent=2))" > docs/api/openapi.json

docs: openapi
    @echo "Docs: http://localhost:8080"
    @echo "API:  http://localhost:8080/api/"
    @echo "MCP:  http://localhost:8080/mcp/"
    {{python}} -m http.server 8080 --directory docs

# --- Report ------------------------------------------------------------------

report:
    cd report && latexmk -pdf -interaction=nonstopmode -outdir=build main.tex

report-clean:
    cd report && latexmk -C -outdir=build main.tex

# --- Housekeeping ------------------------------------------------------------

clean:
    rm -rf .venv .pytest_cache .ruff_cache .mypy_cache node_modules .turbo
    rm -rf apps/web/.next packages/*/dist
    rm -f docs/api/openapi.json
