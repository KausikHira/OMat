"""Composition parsing and similarity.

The source ``Composition`` column is a display label (for example
``TiAl70CrN``), while the authoritative amounts are the ``(symbol, value, unit)``
tuples in the ``Composition`` cell and the element set in ``Elements``.

Rules for the implementation:

- Parse cells with ``ast.literal_eval``, never regex.
- Validate that the ``Elements`` set matches the symbols in the amount list.
- Normalize ``wt%`` to at% using molar masses; ``mol%`` is already at%.
- Emit a periodic-table-ordered vector (118 dimensions) so two compositions can
  be compared with a kNN query instead of text embeddings.
"""

# TODO(phase 0): parse_elemental, to_at_percent, canonical_formula, to_vector.
