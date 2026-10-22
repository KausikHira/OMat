"""Composition parsing and similarity.

The source ``Composition`` cell is a Python literal list of
``(symbol, value, unit)`` tuples parsed with ``ast.literal_eval`` — never
regex. ``symbol`` may be an element (``Ti``) or a compound species (``B2O3``);
``Elements`` holds the expanded atom set.

Rules:
- ``mol`` amounts are already at%.
- ``wt`` amounts convert to at% via molar masses.
- Compound species expand to atoms for ``elements`` (B2O3 -> B, O).
- ``to_vector`` emits 118 dims in atomic-number order for kNN similarity.
"""

from __future__ import annotations

import ast
import re
from typing import Any

from .models import Composition, ElementalAmount, SpeciesAmount

# symbol -> (atomic_number, molar_mass g/mol). IUPAC 2021 conventional weights.
PERIODIC: dict[str, tuple[int, float]] = {
    "H": (1, 1.008), "He": (2, 4.0026), "Li": (3, 6.94), "Be": (4, 9.0122),
    "B": (5, 10.81), "C": (6, 12.011), "N": (7, 14.007), "O": (8, 15.999),
    "F": (9, 18.998), "Ne": (10, 20.180), "Na": (11, 22.990), "Mg": (12, 24.305),
    "Al": (13, 26.982), "Si": (14, 28.085), "P": (15, 30.974), "S": (16, 32.06),
    "Cl": (17, 35.45), "Ar": (18, 39.948), "K": (19, 39.098), "Ca": (20, 40.078),
    "Sc": (21, 44.956), "Ti": (22, 47.867), "V": (23, 50.942), "Cr": (24, 51.996),
    "Mn": (25, 54.938), "Fe": (26, 55.845), "Co": (27, 58.933), "Ni": (28, 58.693),
    "Cu": (29, 63.546), "Zn": (30, 65.38), "Ga": (31, 69.723), "Ge": (32, 72.630),
    "As": (33, 74.922), "Se": (34, 78.971), "Br": (35, 79.904), "Kr": (36, 83.798),
    "Rb": (37, 85.468), "Sr": (38, 87.62), "Y": (39, 88.906), "Zr": (40, 91.224),
    "Nb": (41, 92.906), "Mo": (42, 95.95), "Tc": (43, 98.0), "Ru": (44, 101.07),
    "Rh": (45, 102.91), "Pd": (46, 106.42), "Ag": (47, 107.87), "Cd": (48, 112.41),
    "In": (49, 114.82), "Sn": (50, 118.71), "Sb": (51, 121.76), "Te": (52, 127.60),
    "I": (53, 126.90), "Xe": (54, 131.29), "Cs": (55, 132.91), "Ba": (56, 137.33),
    "La": (57, 138.91), "Ce": (58, 140.12), "Pr": (59, 140.91), "Nd": (60, 144.24),
    "Pm": (61, 145.0), "Sm": (62, 150.36), "Eu": (63, 151.96), "Gd": (64, 157.25),
    "Tb": (65, 158.93), "Dy": (66, 162.50), "Ho": (67, 164.93), "Er": (68, 167.26),
    "Tm": (69, 168.93), "Yb": (70, 173.05), "Lu": (71, 174.97), "Hf": (72, 178.49),
    "Ta": (73, 180.95), "W": (74, 183.84), "Re": (75, 186.21), "Os": (76, 190.23),
    "Ir": (77, 192.22), "Pt": (78, 195.08), "Au": (79, 196.97), "Hg": (80, 200.59),
    "Tl": (81, 204.38), "Pb": (82, 207.2), "Bi": (83, 208.98), "Po": (84, 209.0),
    "At": (85, 210.0), "Rn": (86, 222.0), "Fr": (87, 223.0), "Ra": (88, 226.0),
    "Ac": (89, 227.0), "Th": (90, 232.04), "Pa": (91, 231.04), "U": (92, 238.03),
    "Np": (93, 237.0), "Pu": (94, 244.0), "Am": (95, 243.0), "Cm": (96, 247.0),
    "Bk": (97, 247.0), "Cf": (98, 251.0), "Es": (99, 252.0), "Fm": (100, 257.0),
    "Md": (101, 258.0), "No": (102, 259.0), "Lr": (103, 266.0), "Rf": (104, 267.0),
    "Db": (105, 268.0), "Sg": (106, 269.0), "Bh": (107, 270.0), "Hs": (108, 269.0),
    "Mt": (109, 278.0), "Ds": (110, 281.0), "Rg": (111, 282.0), "Cn": (112, 285.0),
    "Nh": (113, 286.0), "Fl": (114, 289.0), "Mc": (115, 290.0), "Lv": (116, 293.0),
    "Ts": (117, 294.0), "Og": (118, 294.0),
}

MAX_CELL_LEN = 20_000  # literal_eval guard: refuse absurd cells

# Source-data bucket labels, not species. Real example from final_data.csv:
# ('Others', -0.0, 'mol') with Elements minting the fake atom 'Ot'.
SCRAP_SPECIES = {"others", "other", "ot", "balance", "rest", "remainder"}
NEGIGIBLE = 1e-9

_ELEMENT_RE = re.compile(r"\b([A-Z][a-z]?)\b")
# Species token: element symbols glued to counts, e.g. B2O3, La2O3, Y3Al5O12.
_SPECIES_TOKEN_RE = re.compile(r"([A-Z][a-z]?)(\d*\.?\d*)")
_BALANCED_RE = re.compile(r"\(([^()]*)\)(\d*\.?\d*)")


class CompositionError(ValueError):
    """Raised when a composition cell cannot be parsed or validated."""


def parse_literal(cell: str) -> Any:
    """``ast.literal_eval`` with a length cap. Raises CompositionError on junk."""
    if cell is None:
        raise CompositionError("cell is None")
    if len(cell) > MAX_CELL_LEN:
        raise CompositionError(f"cell too long ({len(cell)} chars)")
    try:
        return ast.literal_eval(cell)
    except (ValueError, SyntaxError, MemoryError, RecursionError) as exc:
        raise CompositionError(f"literal_eval failed: {exc}") from exc


def molar_mass(formula: str) -> float:
    """Molar mass of a flat formula string like ``B2O3`` or ``Y3Al5O12``.

    Raises CompositionError for unknown symbols. Parentheses are expanded by
    the caller via ``_expand_groups`` before this runs.
    """
    total = 0.0
    pos = 0
    for match in _SPECIES_TOKEN_RE.finditer(formula):
        if match.start() != pos:
            raise CompositionError(f"unparsable formula segment in {formula!r}")
        symbol, count = match.group(1), match.group(2)
        if symbol not in PERIODIC:
            raise CompositionError(f"unknown element {symbol!r} in {formula!r}")
        total += PERIODIC[symbol][1] * (float(count) if count else 1.0)
        pos = match.end()
    if pos != len(formula) or not formula:
        raise CompositionError(f"unparsable formula {formula!r}")
    return total


def _atom_counts(formula: str, multiplier: float = 1.0) -> dict[str, float]:
    """Expand a formula into {symbol: atom_count}, handling one nesting level
    recursively (e.g. Ca(OH)2 -> Ca:1, O:2, H:2)."""
    counts: dict[str, float] = {}
    while True:
        match = _BALANCED_RE.search(formula)
        if not match:
            break
        inner, group_count = match.group(1), match.group(2)
        factor = multiplier * (float(group_count) if group_count else 1.0)
        for symbol, n in _atom_counts(inner, factor).items():
            counts[symbol] = counts.get(symbol, 0.0) + n
        formula = formula[: match.start()] + formula[match.end():]
    for match in _SPECIES_TOKEN_RE.finditer(formula):
        symbol, count = match.group(1), match.group(2)
        if symbol not in PERIODIC:
            raise CompositionError(f"unknown element {symbol!r} in formula")
        counts[symbol] = counts.get(symbol, 0.0) + multiplier * (
            float(count) if count else 1.0
        )
    return counts


def species_to_atoms(species: str) -> dict[str, float]:
    """One species token (``B2O3``, ``SiO2``, ``Ca(OH)2``) -> atom counts."""
    species = species.strip()
    if species in PERIODIC:
        return {species: 1.0}
    return _atom_counts(species)


def to_at_percent(species: list[SpeciesAmount]) -> list[ElementalAmount]:
    """Convert amounts to at%. ``mol`` is already at%; ``wt`` needs molar
    masses. Compound species contribute their constituent atoms proportionally
    to their amount."""
    if not species:
        return []

    mole_amounts: dict[str, float] = {}
    for sp in species:
        if sp.unit == "mol":
            atoms = species_to_atoms(sp.symbol)
            weight_total = sum(atoms.values())
            if weight_total <= 0:
                raise CompositionError(f"degenerate species {sp.symbol!r}")
            for atom, n in atoms.items():
                mole_amounts[atom] = mole_amounts.get(atom, 0.0) + sp.value * n / weight_total
        elif sp.unit == "wt":
            atoms = species_to_atoms(sp.symbol)
            mass = molar_mass_flat(sp.symbol)
            if mass <= 0:
                raise CompositionError(f"zero molar mass for {sp.symbol!r}")
            moles = sp.value / mass
            weight_total = sum(atoms.values())
            for atom, n in atoms.items():
                mole_amounts[atom] = mole_amounts.get(atom, 0.0) + moles * n / weight_total
        else:
            raise CompositionError(f"unknown unit {sp.unit!r}; expected mol or wt")

    total = sum(mole_amounts.values())
    if total <= 0:
        raise CompositionError("composition sums to zero")
    return [
        ElementalAmount(symbol=sym, at_pct=100.0 * amt / total)
        for sym, amt in sorted(mole_amounts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]


def molar_mass_flat(formula: str) -> float:
    """Molar mass supporting parentheses via _atom_counts sums."""
    counts = _atom_counts(formula)
    return sum(PERIODIC[sym][1] * n for sym, n in counts.items())


def canonical_formula(elements: list[ElementalAmount]) -> str:
    """``Al95.89-Cr1.37-N1.37-Ti1.37`` — descending at%, then symbol."""
    return "-".join(
        f"{e.symbol}{round(e.at_pct, 2)}" for e in elements
    )


def to_vector(elements: list[ElementalAmount], dims: int = 118) -> list[float]:
    """Periodic-table-ordered at% vector for kNN similarity."""
    vec = [0.0] * dims
    for e in elements:
        z = PERIODIC[e.symbol][0]
        vec[z - 1] = e.at_pct
    return vec


def parse_composition(
    composition_cell: str,
    elements_cell: str | None = None,
    label: str | None = None,
    strict_elements: bool = False,
) -> tuple[Composition | None, str | None]:
    """Parse a Composition cell (and optional Elements set) into a Composition.

    Returns ``(composition, warning)``. ``composition`` is None when the cell
    is an empty list. Warnings are non-fatal (e.g. amounts not summing to 100);
    errors raise CompositionError.

    ``strict_elements=True`` (the old plan rule) rejects symbol-set mismatches;
    the real data expands oxides into atoms, so default is a warning only.
    """
    raw = parse_literal(composition_cell)
    if not isinstance(raw, list):
        raise CompositionError(f"expected list, got {type(raw).__name__}")
    if not raw:
        return None, None

    species: list[SpeciesAmount] = []
    dropped: list[str] = []
    for item in raw:
        if not isinstance(item, (tuple, list)) or len(item) != 3:
            raise CompositionError(f"malformed species entry: {item!r}")
        symbol, value, unit = item
        if not isinstance(symbol, str) or not symbol.strip():
            raise CompositionError(f"bad symbol in {item!r}")
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise CompositionError(f"non-numeric amount in {item!r}")
        if not isinstance(unit, str):
            raise CompositionError(f"bad unit in {item!r}")
        symbol, value = symbol.strip(), float(value)
        if symbol.lower() in SCRAP_SPECIES or value < 0:
            dropped.append(f"{symbol}={value}")
            continue
        species.append(SpeciesAmount(symbol=symbol, value=value, unit=unit))

    if not species:
        if dropped:
            return None, f"dropped non-species entries {dropped}; nothing left"
        return None, None

    elements = to_at_percent(species)

    warning: str | None = None
    if dropped:
        warning = f"dropped non-species/negative entries {dropped}"
    # Sum check on the RAW amounts, before renormalization: at% always sums
    # to 100 after to_at_percent, so it cannot flag bad source rows.
    raw_total = sum(sp.value for sp in species)
    if not (99.0 <= raw_total <= 101.0):
        sum_warning = f"amounts sum to {raw_total:.2f}, expected ~100"
        warning = f"{warning}; {sum_warning}" if warning else sum_warning

    parsed_atoms = {e.symbol for e in elements}
    declared: set[str] | None = None
    if elements_cell is not None:
        declared_raw = parse_literal(elements_cell)
        if isinstance(declared_raw, (set, frozenset, list, tuple)):
            declared = {str(s).strip() for s in declared_raw if str(s).strip()}
            if declared and declared != parsed_atoms:
                if strict_elements:
                    raise CompositionError(
                        f"Elements set {sorted(declared)} != parsed atoms {sorted(parsed_atoms)}"
                    )
                warning = (
                    f"Elements set {sorted(declared)} != parsed atoms {sorted(parsed_atoms)}"
                )

    comp = Composition(
        label=label,
        species=species,
        elements=elements,
        canonical=canonical_formula(elements),
        vector=to_vector(elements),
    )
    return comp, warning
