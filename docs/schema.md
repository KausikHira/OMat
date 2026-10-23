# Data schema

## Source columns

`data/final_data.csv` has eight columns. Journal, year, and record identity are
derived during ingest.

| Source | Meaning | Notes |
| --- | --- | --- |
| `Article PII` | Publisher Item Identifier | Not personal data |
| `DOI` | Paper DOI | Normalized to lowercase, no `https://doi.org/` prefix |
| `Composition` | Elemental/species amounts | Python list literal; authoritative composition |
| `Property` | `(name, value, unit)` | One tuple per row, or an empty tuple for composition-only rows |
| `Elements` | Element set | Python set literal; compared with the expanded composition |
| `APL_Group` | Application groups | Python list literal; may be empty |
| `Paper_Link` | DOI link from the source | Stored for provenance; clients derive display links from `doi` |
| `Title` | Paper title | Populated from the CSV (Crossref mapping by PII); may be empty |

Derived fields: `record_id` (stable hash of PII + DOI + row index), normalized
DOI, journal metadata (from the DOI path), year (from Elsevier DOI patterns),
expanded at% amounts, application slugs, and `search_text`.

## Canonical document

```json
{
  "record_id": "c638e9bcdb41c43f",
  "row_index": 1,
  "article_pii": "S0167577X2031716X",
  "doi": "10.1016/j.matlet.2020.129009",
  "paper_link": "https://doi.org/10.1016/j.matlet.2020.129009",
  "has_composition": true,
  "has_property": true,
  "composition": {
    "label": null,
    "species": [
      { "symbol": "Al", "value": 95.89, "unit": "mol" },
      { "symbol": "Cr", "value": 1.37, "unit": "mol" },
      { "symbol": "N", "value": 1.37, "unit": "mol" },
      { "symbol": "Ti", "value": 1.37, "unit": "mol" }
    ],
    "elements": [
      { "symbol": "Al", "at_pct": 95.89 },
      { "symbol": "Cr", "at_pct": 1.37 },
      { "symbol": "N", "at_pct": 1.37 },
      { "symbol": "Ti", "at_pct": 1.37 }
    ],
    "canonical": "Al95.89-Cr1.37-N1.37-Ti1.37"
  },
  "property": {
    "raw": "Youngs modulus",
    "name": "Young's modulus",
    "slug": "youngs_modulus",
    "value": 467.0,
    "unit": "GPa",
    "value_si": 467000000000.0
  },
  "elements": ["Al", "Cr", "N", "Ti"],
  "species": ["Al", "Cr", "N", "Ti"],
  "journal": {
    "raw": "Materials Letters",
    "name": "Materials Letters",
    "slug": "matlet"
  },
  "year": 2020,
  "applications": [
    { "raw": "Coatings / Barriers", "slug": "coatings-barriers" }
  ],
  "title": "Micro-scale impact resistance of coatings on hardened tool steel and cemented carbide",
  "abstract": null,
  "search_text": "Al95.89-Cr1.37-N1.37-Ti1.37 Al Cr N Ti Young's modulus Materials Letters Coatings Barriers"
}
```

The example omits `composition.vector`, a 118-value periodic-table-ordered array
used by the kNN field. `composition.label` is `null` for the current CSV because
the source has no separate label column; `canonical` is the display formula.

## Index fields

| Field | Type | Purpose |
| --- | --- | --- |
| `record_id`, `article_pii`, `doi` | keyword | Record identity and exact lookup |
| `row_index` | integer | Source order and stable tiebreaker |
| `paper_link` | keyword (index: false) | Display/provenance only |
| `has_composition`, `has_property` | boolean | Coverage and analytics filters |
| `composition.label` | keyword | Source label, when present |
| `composition.species` | object | Amounts as written (`symbol`, `value`, `unit`) |
| `composition.elements` | object | Expanded atoms (`symbol`, `at_pct`) |
| `composition.canonical` | keyword | Exact composition match |
| `composition.vector` | knn_vector | 118-dim composition similarity |
| `elements` / `species` | keyword | Element and species facets |
| `property.raw` / `.name` | text | Property search |
| `property.slug` | keyword | Property facet and exact filter |
| `property.value` / `.value_si` | double | Range filter and sort |
| `property.unit` | keyword | Display |
| `journal.name` | text + keyword subfield | Search and facet |
| `journal.raw` / `.slug` | keyword | Provenance and facet |
| `year` | integer | Range filter and histogram |
| `applications.raw` / `.slug` | keyword | Application facet |
| `search_text` | text | Catch-all BM25 field |
| `title`, `abstract` | text | Paper metadata and search |
| `authors`, `related_papers` | keyword | Declared for enrichment; currently empty |

## Query interpretation

Free-text queries are rewritten in `py-core` before they reach the index: filler
removal, curated intent mapping, and synonym expansion. See
[search.md](search.md) for the full rules and examples.

## Validation rules

- `Article PII` must match `^S\d{7}[0-9X]\d{7}[0-9X]$` (uppercase, 17 chars).
- DOI must match `^10\.\d{4,9}/\S+$`.
- `Composition` and `Elements` are Python literals parsed with
  `ast.literal_eval`; cells are length-capped before parsing.
- `mol` amounts are already at%; `wt` amounts are converted to at%. Compound
  species expand to their constituent atoms.
- Negative amounts and bucket labels such as `Others` are dropped with a
  warning. Raw amounts outside 99–101 are warned about, not rejected.
- A mismatch between `Elements` and the expanded composition is a warning, not a
  rejection or a silent rewrite.
- A non-empty `Property` must be a `(name, value, unit)` tuple. An empty tuple
  marks a composition-only row.
- Unknown property names and units are kept with a derived slug / identity
  conversion; taxonomy curation happens separately in `data/taxonomy/`.
- Year is parsed from the DOI and is `null` when absent or outside 1900–2027.
- Duplicate records are detected by DOI + canonical composition + property slug +
  value; later duplicates are counted and dropped.
- Empty `APL_Group` becomes an empty application list; records are never dropped
  for it.
- Rejected rows are written to `data/rejects/rejects.jsonl` (or the `--rejects`
  directory) with the source row preview and a machine-readable reason.

## Search response

`GET /v1/search` returns `{ data, total, took_ms, cursor }`. Facets come from
`GET /v1/facets`; they are not embedded in the search response. See
[search.md](search.md) for cursor and caching rules.
