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

index path="data/raw":
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
    @echo "API docs: http://localhost:8080"
    {{python}} -m http.server 8080 --directory docs/api

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
