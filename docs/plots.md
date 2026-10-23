# Plots

The Plots tab (`/search?tab=plots`) renders aggregate views. The three-property
scatter and GSC chart are fed by the aggregate endpoint; the secondary summaries
are computed server-side from the current result set. Raw result sets are never
shipped to a browser chart library.

## Property map with material criteria (three-property scatter)

The headline plot is a port of `plot_3_props_ultimate_with_filtering.ipynb`:

- Materials measured for **all three** chosen properties become one `(x, y)`
  point, **colored by the third property** (matplotlib `spring` colormap,
  black edges). A paper's material identity is `(article_pii, composition)`.
- **Ultimate filtering**: a material whose value on any of the three axes
  falls outside that axis's 1st/99th percentile (pandas `quantile`
  semantics) is dropped from the plot entirely.
- **Criteria highlighting**: materials satisfying all three `>= threshold`
  conditions are **ringed in blue** and the criteria are shown in bold above
  the chart (the notebook's bold-lettered required properties).
- Defaults reproduce the notebook's active criteria set ("criteria 8"):
  glass transition temperature / activation energy / crystallization
  temperature with thresholds 600 K / 2 eV / 800 K, whenever those properties
  exist in the result set; otherwise the most-measured properties of the
  current search are used. Any combination is a shareable URL
  (`propX`/`propY`/`propZ`, `thX`/`thY`/`thZ`).

### Data source

`GET /v1/aggregates?kind=props_scatter&property_a=…&property_b=…&property_c=…`
(+ optional `threshold_a/b/c`). The endpoint runs a bounded `search_after`
scan (max 4,000 docs) over documents measuring any of the three properties
and hands the rows to py-core (`packages/py-core/src/omat_core/props_plot.py`)
for the merge/filter/flag math. On the wire each point is a bare
`[x, y, z, highlighted]` tuple; the web adapter converts tuples to objects.

## Other aggregate kinds

`GET /v1/aggregates?kind=…` also powers the secondary charts:

| Kind | Chart |
| --- | --- |
| `property_hist` | Value distribution of one property |
| `records_by_year` | Records per publication year |
| `top_journals` | Horizontal bars by journal |
| `element_pairs` | Element co-occurrence |
| `property_by_year` | Average property value per year |
| `gsc` | Two-property family hulls (the earlier `final_gsc_3.ipynb` chart; still served by the API) |

The Plots tab additionally renders papers-by-year, papers-by-journal, and
measurements-by-property summaries derived server-side from the current result
set (up to the search page limit).

## Client rendering rules

- All charts are **inline SVG rendered on the server** — no chart library, no
  client component, no dynamic chunk. Tooltips are native `<title>` elements;
  chart math (domains, nice ticks, scaling, colormaps) lives in pure, tested
  functions (`apps/web/src/lib/gsc-chart.ts`, `apps/web/src/lib/props-scatter.ts`).
- Plotly was dropped deliberately (stale React-16 wrapper crashing under
  React 19, then a ~1.4 MB client chunk that failed to load in some
  browsers); react-plotly.js was dropped before that. Any future chart should
  follow the same rule: prefer SVG/CSS server-rendered from aggregate data;
  add a chart library only when a plot genuinely cannot be expressed that way.
