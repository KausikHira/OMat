"""Natural-language query interpretation.

A user question like "I want to make a house near a riverbed, what type of
concrete should I use" cannot be answered by a literal BM25 match: the words
that carry intent (house, riverbed, concrete) are not what the index stores.
``interpret_query`` rewrites such questions into a search the index can answer:

1. conversational filler ("I want to", "should I use") is dropped from the
   text match;
2. domain words are mapped through the curated intent lexicon
   (``data/taxonomy/intents.yaml``) to application/property facet slugs;
3. lexicon synonyms expand the surviving text ("concrete" -> "cement mortar").

This is pure keyword work — no embeddings and no model calls
(docs/adr/0001-stack-and-data-model.md). If the lexicon file is missing the
interpretation degrades to filler removal only, so deployed environments
without the data directory still work.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from .taxonomy import find_taxonomy_dir

__all__ = ["InterpretedQuery", "interpret_query"]

_TOKEN_RE = re.compile(r"[A-Za-z0-9']+")

# Fallback filler list used when intents.yaml is not installed. Mirrors the
# file; the file wins when present.
_DEFAULT_FILLER_WORDS = """
    i im ive me my we you a an the to of for in on at near with and or is are
    be was were do does did what which who how why when where should could
    would can may might will want wants wanted need needs needed looking
    look looks show give recommend suggest best good better make makes making
    use using used type kind material materials please help hi hello there
    here this that these those it its about some any
    """

_DEFAULT_FILLER = frozenset(_DEFAULT_FILLER_WORDS.split())


@dataclass(frozen=True)
class InterpretedQuery:
    """Rewritten query plus the taxonomy facets the wording implies."""

    text: str
    property_slugs: tuple[str, ...] = ()
    application_slugs: tuple[str, ...] = ()
    matched_words: tuple[str, ...] = ()  # which lexicon entries fired


@lru_cache(maxsize=4)
def _load_intents(dir_path: str) -> dict[str, Any] | None:
    path = Path(dir_path) / "intents.yaml"
    if not path.is_file():
        return None
    return yaml.safe_load(path.read_text()) or None


def _intents() -> dict[str, Any] | None:
    try:
        directory = find_taxonomy_dir()
    except FileNotFoundError:
        return None
    return _load_intents(str(directory))


def _matched(words: list[Any], token_set: set[str], padded_text: str) -> list[str]:
    """Lexicon entries hit by single tokens or by whole phrases."""
    hits: list[str] = []
    for entry in words or []:
        entry = str(entry).strip().lower()
        if not entry:
            continue
        if " " in entry:
            if f" {entry} " in padded_text:
                hits.append(entry)
        elif entry in token_set:
            hits.append(entry)
    return hits


def interpret_query(q: str | None) -> InterpretedQuery:
    """Rewrite a free-text search into text terms + implied taxonomy facets.

    Technical queries pass through untouched: ``interpret_query("TiAlN
    coating")`` keeps the text as-is and fires no facets, because those words
    are not in the lexicon. Purely conversational input falls back to the
    original string so the caller's behavior for garbage is unchanged.
    """
    q = (q or "").strip()
    if not q:
        return InterpretedQuery(text="")

    intents = _intents()
    filler = _DEFAULT_FILLER
    if intents and intents.get("filler_words"):
        filler = frozenset(str(w).strip().lower() for w in intents["filler_words"])

    # Original case is preserved: the standard tokenizer splits "TiAlN" but
    # not "tialn", so lowercasing here would break composition queries.
    tokens = [t for t in _TOKEN_RE.findall(q) if t.lower() not in filler]
    text = " ".join(tokens) or q

    token_set = set(text.lower().split())
    padded_text = f" {text.lower()} "

    property_slugs: list[str] = []
    application_slugs: list[str] = []
    matched_words: list[str] = []
    extra_terms: list[str] = []

    if intents:
        for slug, words in (intents.get("applications") or {}).items():
            hits = _matched(words, token_set, padded_text)
            if hits:
                application_slugs.append(str(slug))
                matched_words.extend(hits)
        for slug, words in (intents.get("properties") or {}).items():
            hits = _matched(words, token_set, padded_text)
            if hits:
                property_slugs.append(str(slug))
                matched_words.extend(hits)
        for source, expansions in (intents.get("synonyms") or {}).items():
            if _matched([source], token_set, padded_text):
                matched_words.append(str(source))
                for term in expansions or []:
                    term = str(term).strip().lower()
                    if term and term not in token_set:
                        extra_terms.append(term)

    if extra_terms:
        text = f"{text} {' '.join(dict.fromkeys(extra_terms))}"

    return InterpretedQuery(
        text=text,
        property_slugs=tuple(property_slugs),
        application_slugs=tuple(application_slugs),
        matched_words=tuple(dict.fromkeys(matched_words)),
    )
