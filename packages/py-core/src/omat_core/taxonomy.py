"""Taxonomy loading.

Four curated YAML files under ``data/taxonomy/`` drive search quality:

- ``properties.yaml``: raw label -> slug, display name, default unit
- ``units.yaml``: unit aliases and SI conversion factors
- ``journals.yaml``: underscore/case variants -> display name and slug
- ``applications.yaml``: APL group -> slug and display label

Load once per process, validate with pydantic, and fail loudly on unknown
labels rather than silently dropping records.
"""

# TODO(phase 0): load_taxonomy() and the lookup helpers used by py-ingest.
