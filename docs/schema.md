# Data schema

## Source columns

The CSV has eleven columns. The original brief listed ten; compared with that
list, `Elements`, `APL_Group`, and `Date` are present in the data, `Paper_Link`
is absent, and `Applications` is stored as `APL_Group`.

| Source | Meaning | Notes |
| --- | --- | --- |
| `Article PII` | Publisher Item Identifier | Not personal data |
| `DOI` | Paper DOI | Normalize to lowercase, strip `https://doi.org/` |
| `Table No.` | Table references | Python list literal, e.g. `[1]` |
| `ID` | Source material label/identifier | Verify whether it repeats across papers |
| `Proxy_ID` | Record identifier | Primary key, paper PII + row |
| `Composition` | Label + elemental amounts | Python literal; authoritative amounts |
| `Property` | `(name, value, unit)` | Tuple or list of tuples |
| `Journal_Name` | Journal | Underscored source label |
| `Elements` | Element set | Python set literal; must match composition |
| `APL_Group` | Application group | Python list literal |
| `Date` | Year | Integer, no month/day |

Derived fields: `paper_link` (`https://doi.org/<doi>`), canonical formula, at%
amounts, element vector, and `search_text`.

## Canonical document

```json
{
  "record_id": "S0167577X2031716X_0_R_5::youngs_modulus",
  "proxy_id": "S0167577X2031716X_0_R_5",
  "article_pii": "S0167577X2031716X",
  "doi": "10.1016/j.matlet.2020.129009",
  "paper_link": "https://doi.org/10.1016/j.matlet.2020.129009",
  "legacy_id": "TiAl70CrN",
  "table_nos": [1],
  "year": 2020,
  "journal": {
    "raw": "Materials_Letters",
    "name": "Materials Letters",
    "slug": "materials-letters"
  },
  "composition": {
    "label": "TiAl70CrN",
    "elements": ["Al", "Cr", "N", "Ti"],
    "elemental": [
      { "symbol": "Al", "value": 95.89, "unit": "mol", "at_pct": 95.89 },
      { "symbol": "Cr", "value": 1.37, "unit": "mol", "at_pct": 1.37 }
    ],
    "canonical": "Al95.89-Cr1.37-N1.37-Ti1.37",
    "vector": []
  },
  "property": {
    "raw": "Youngs modulus",
    "name": "Young's modulus",
    "slug": "youngs_modulus",
    "value": 467.0,
    "unit": "GPa",
    "value_si": 4.67e11
  },
  "applications": [{ "raw": "Coatings / Barriers", "slug": "coatings-barriers" }],
  "search_text": "TiAl70CrN Al Cr N Ti Youngs modulus Materials Letters Coatings Barriers"
}
```

## Index fields

| Field | Type | Purpose |
| --- | --- | --- |
| `doi`, `article_pii`, `proxy_id`, `legacy_id` | keyword | Exact lookup and joins |
| `paper_link` | keyword (index: false) | Display only |
| `journal.name` / `.slug` | text / keyword | Search / facet |
| `composition.label` | text + keyword | Label search and exact match |
| `composition.elements` | keyword | Multi-select element facet |
| `composition.elemental` | object/nested | Amounts and provenance |
| `composition.canonical` | keyword | Dedupe and exact composition match |
| `composition.vector` | knn_vector | Similar compositions (phase 2) |
| `property.name` / `.slug` | text / keyword | Search / facet |
| `property.value` | double | Range filter and sort |
| `property.unit` | keyword | Display and facet |
| `applications.slug` | keyword | Application facet |
| `year` | integer | Range filter and histogram |
| `table_nos` | integer | Provenance |
| `search_text` | text | Catch-all BM25 field |
| `title`, `abstract` | text | Enrichment fields used by paper listings |

`title` and `abstract` are optional enrichment fields. The CSV pipeline leaves
them empty; a later enrichment pass may populate them. The web app falls back to
measurement-derived labels when they are absent.

## Validation rules

- `proxy_id` must be unique per property; duplicates keep the latest `Date` and
  are reported.
- Elemental amounts sum to 100 ± 0.5.
- Symbols in `Elements` must match symbols in the composition amounts.
- Property values are finite numbers; units must exist in `units.yaml`.
- Year is between 1900 and 2027, otherwise null.
- DOI matches `^10\.\d{4,9}/\S+$`.
- Empty `APL_Group` becomes `unclassified`; records are never dropped for it.

Rejected rows are written to `data/rejects/<run>/` with the original line and a
machine-readable reason, so the cleaning rules can be tuned without guesswork.

## API envelope

```json
{
  "data": [],
  "total": 12400,
  "facets": {},
  "took_ms": 12,
  "cursor": "opaque-base64",
  "index_version": "papers_v1"
}
```

`total` may be capped for large result sets. The cursor is the only supported
pagination mechanism; offsets are not exposed.
