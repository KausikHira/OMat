"""Taxonomy loader: data/taxonomy/*.yaml is the reviewable source of truth.

Resolution order for the taxonomy directory:
1. ``OMAT_TAXONOMY_DIR`` env var
2. walk upward from CWD looking for ``data/taxonomy``
3. repo-relative fallback next to this package tree
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    """``Coatings / Barriers`` -> ``coatings-barriers``; ``Youngs modulus`` ->
    ``youngs_modulus`` (underscores for property slugs, dashes for the rest is
    handled by callers — slugify itself uses dashes and callers may replace)."""
    slug = _SLUG_RE.sub("-", text.strip().lower()).strip("-")
    return slug or "unknown"


@dataclass(frozen=True)
class PropertyDef:
    slug: str
    display: str
    aliases: tuple[str, ...]


@dataclass(frozen=True)
class UnitDef:
    raw: str  # "GPa" or "dimensionless"
    si_unit: str
    factor: float


@dataclass(frozen=True)
class JournalDef:
    doi_slug: str
    name: str
    slug: str


@dataclass
class Taxonomy:
    properties_by_alias: dict[str, PropertyDef] = field(default_factory=dict)
    units: dict[str, UnitDef] = field(default_factory=dict)
    journals: dict[str, JournalDef] = field(default_factory=dict)
    applications_raw: list[str] = field(default_factory=list)

    def property_for(self, raw_name: str) -> PropertyDef:
        key = raw_name.strip()
        if key in self.properties_by_alias:
            return self.properties_by_alias[key]
        # Unknown property: derive a slug rather than fail. New names land in
        # properties.yaml on the next curation pass.
        slug = slugify(key).replace("-", "_")
        return PropertyDef(slug=slug, display=key, aliases=(key,))

    def unit_for(self, raw: str | None) -> UnitDef:
        if raw is None:
            return self.units["dimensionless"]
        key = raw.strip()
        if key in self.units:
            return self.units[key]
        # Unknown unit: identity conversion, flagged by the caller.
        return UnitDef(raw=key, si_unit=key, factor=1.0)

    def journal_for_doi(self, doi: str) -> JournalDef | None:
        """Match ``10.1016/j.ceramint.2020...`` -> JournalDef by path slug."""
        match = re.match(r"^10\.\d+/j\.([a-z0-9]+)\.", doi.lower())
        if not match:
            return None
        return self.journals.get(match.group(1))


def find_taxonomy_dir(start: Path | None = None) -> Path:
    env = os.environ.get("OMAT_TAXONOMY_DIR")
    if env:
        candidate = Path(env)
        if candidate.is_dir():
            return candidate
    current = (start or Path.cwd()).resolve()
    for candidate in [current, *current.parents]:
        target = candidate / "data" / "taxonomy"
        if target.is_dir():
            return target
    raise FileNotFoundError("data/taxonomy not found; set OMAT_TAXONOMY_DIR or run from the repo")


@lru_cache(maxsize=4)
def _load(dir_path: str) -> Taxonomy:
    root = Path(dir_path)
    taxonomy = Taxonomy()

    props = yaml.safe_load((root / "properties.yaml").read_text())["properties"]
    for slug, spec in props.items():
        definition = PropertyDef(
            slug=slug, display=spec["display"], aliases=tuple(spec.get("aliases", []))
        )
        taxonomy.properties_by_alias[slug.replace("_", " ")] = definition
        taxonomy.properties_by_alias[spec["display"]] = definition
        for alias in definition.aliases:
            taxonomy.properties_by_alias[alias] = definition

    units = yaml.safe_load((root / "units.yaml").read_text())["units"]
    for raw, spec in units.items():
        taxonomy.units[raw] = UnitDef(
            raw=raw,
            si_unit=spec["si_unit"],
            factor=float(spec["factor"]),
        )

    journals = yaml.safe_load((root / "journals.yaml").read_text())["journals"]
    for doi_slug, spec in journals.items():
        taxonomy.journals[doi_slug] = JournalDef(
            doi_slug=doi_slug, name=spec["name"], slug=doi_slug
        )

    apps = yaml.safe_load((root / "applications.yaml").read_text())["applications"]
    taxonomy.applications_raw = [entry["raw"] for entry in apps]

    # dimensionless must always exist even if units.yaml is edited badly
    taxonomy.units.setdefault(
        "dimensionless", UnitDef(raw="dimensionless", si_unit="1", factor=1.0)
    )
    return taxonomy


def load_taxonomy(directory: Path | None = None) -> Taxonomy:
    return _load(str(find_taxonomy_dir(directory)))
