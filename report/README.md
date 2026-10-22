# Report

LaTeX source for the OMAT-SE write-up.

```bash
just report        # from the repo root; writes report/build/main.pdf
just report-clean
```

`latexmk` and a TeX distribution (MacTeX or TeX Live) are required. The document
uses `natbib` with BibTeX, so run `latexmk` rather than a single `pdflatex`
invocation if you build manually.

Figures go in `report/figures/`; bibliography entries in `references.bib`.
