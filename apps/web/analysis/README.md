# GSC analysis notebook

`gsc-composition-families.ipynb` is the research prototype for the glass-structure/composition
(GSC) chart in the Plots tab. It pairs measurement records that share an article
and composition, groups them into element-set families, and draws a smoothed
convex hull per family.

The production port lives in two places and must stay behaviourally aligned with
this notebook:

- `packages/py-core/src/omat_core/gsc.py` — canonical pairing, families, hull,
  and smoothing used by `GET /v1/aggregates?kind=gsc`.
- `apps/web/src/lib/gsc.ts` — TypeScript mirror used for the local mock dataset
  and the server-rendered SVG chart components.

The notebook depends on SciPy (`ConvexHull`, `splprep`/`splev`). The production
code replaces that with a monotone-chain hull and two-round Chaikin smoothing so
neither the API nor the browser needs SciPy. Keep the 12-family cap, the
element-set family key, and the "drop values <= 0" rule in sync.

Input data is not committed. Regenerate the pairs from the indexed measurement
records rather than committing the notebook's CSV.
