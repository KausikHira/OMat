"""Canonical domain models.

Phase 0 defines the contracts before any cleaning code is written:

- ``Record``: one measurement property, keyed by ``record_id`` and grouped by
  ``proxy_id``. A source row with N properties becomes N records.
- ``Composition``: the label (``TiAl70CrN``), the authoritative elemental list,
  at% normalization, a canonical string, and a periodic-table-ordered vector.
- ``Properties``: name/slug/value/unit with a ``value_si`` for range queries.
- ``Paper``: the grouping view returned by ``GET /v1/papers/{doi_or_pii}``.

Keep raw strings next to normalized ones. Source labels are evidence; never
overwrite them during cleanup.
"""

SCHEMA_VERSION = "1"

# TODO(phase 0): implement Record, Composition, PropertyValue, Paper with
# pydantic v2 models. Source cells are Python literals parsed with
# ast.literal_eval, not regular expressions.
