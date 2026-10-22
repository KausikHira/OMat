# Plots

The Plots tab (`/search?tab=plots`) renders aggregate views of the current
result set. Charts are always fed by the aggregate endpoint, never by the raw
result set in the browser.

## GSC chart (property vs property)

The headline plot is a port of the analysis notebook (`final_gsc_3.ipynb`):
every material that was measured for **both** chosen properties becomes one
`(x, y)` point, and points are grouped into composition *families* by element
set. Each family is drawn as a smoothed, filled convex-hull blob — the visual
signature of the notebook chart.

- **Backend math** lives in py-core (`packages/py-core/src/omat_core/gsc.py`):
  materials are joined by `(article_pii, composition)` across property
  documents, zero/negative values are dropped, families are ranked by material
  count (top 12), and hulls with fewer than 3 vertices (collinear points) are
  skipped because they have no area to fill. Hulls are smoothed with two
  rounds of closed Chaikin corner cutting instead of scipy splines, keeping
  py-core dependency-light.
- **Data source**: `GET /v1/aggregates?kind=gsc&property_a=…&property_b=…`.
  The endpoint runs a bounded `search_after` scan (max 4,000 docs) over
  documents measuring either property, then hands the rows to py-core.
- **Axis choice is search-relevant**: when the URL does not pin `gscA`/`gscB`,
  the axes default to the most-measured pairable properties in the current
  result set (a conductivity search plots conductivity, not the notebook's
  hardness/density stand-ins). The pair selectors are a plain GET form, so any
  plot is a shareable URL.

## Other aggregate kinds

`GET /v1/aggregates?kind=…` also powers the secondary charts:

| Kind | Chart |
| --- | --- |
| `property_hist` | Value distribution of one property |
| `records_by_year` | Records per publication year |
| `top_journals` | Horizontal bars by journal |
| `element_pairs` | Element co-occurrence |
| `property_by_year` | Average property value per year |

The Plots tab additionally renders papers-by-year, papers-by-journal, and
measurements-by-property summaries derived server-side from the current page
of results.

## Client rendering rules

- Plotly is browser-only. The chart lives in a client component
  (`apps/web/src/components/gsc-chart-plot.tsx`) that is loaded exclusively via
  `dynamic(() => import(...), { ssr: false })` — the server renders a loading
  placeholder and the browser swaps the chart in after hydration.
- The bundle is `plotly.js-cartesian-dist-min` (scatter/line/bar only,
  ~1.4 MB chunk) wired through `react-plotly.js/factory`, not the full
  `plotly.js` build (~3.5 MB) that the `react-plotly.js` peer dependency
  would pull in.
- Plotly's TypeScript types are version-split in the store
  (`@types/plotly.js` v2 and v3); the components use local structural types
  plus one ambient declaration for the untyped cartesian dist, so no version
  of `@types/plotly.js` is trusted.

## Verified behaviour

- `kind=gsc&property_a=hardness&property_b=density` over the current index:
  ~170 paired materials across 12 families, each hull smoothed to 16–24
  vertices.
- Degenerate families (fewer than 3 unique points, aligned on an axis, or
  collinear) are skipped — matching scipy's `ConvexHull`, which raises on
  collinear input.
