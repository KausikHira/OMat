"""Index mapping and versioning constants. No imports from the package
``__init__`` — ``client.py`` imports from here, so keep this module leaf-level."""

from __future__ import annotations

from typing import Any

from ..models import SCHEMA_VERSION

INDEX_VERSION = SCHEMA_VERSION  # bumps to "2" on the next mapping change
ALIAS = "papers"


def index_name(version: str = INDEX_VERSION) -> str:
    return f"papers_v{version}"


def papers_mapping() -> dict[str, Any]:
    """Mapping for papers_v1. Keyword arrays for facets; doubles for ranges."""
    return {
        "settings": {
            "index": {
                "knn": True,
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "refresh_interval": "1s",
            },
            "analysis": {
                "analyzer": {
                    "omat_text": {
                        "type": "custom",
                        "tokenizer": "standard",
                        "filter": ["lowercase", "omat_synonym"],
                    }
                },
                "filter": {
                    "omat_synonym": {
                        "type": "synonym",
                        # Inlined (not synonyms_path) so no container mount is needed.
                        "synonyms": [
                            "youngs modulus, young's modulus",
                            "electrical conductivity, electric conductivity",
                            "glass transition temperature, tg",
                            "thermal expansion coefficient, cte",
                            "high entropy alloy, hea",
                            "coating, coatings, barrier",
                        ],
                    }
                },
            },
        },
        "mappings": {
            "dynamic": "strict",
            "properties": {
                "record_id": {"type": "keyword"},
                "row_index": {"type": "integer"},
                "article_pii": {"type": "keyword"},
                "doi": {"type": "keyword"},
                "paper_link": {"type": "keyword", "index": False},
                "has_composition": {"type": "boolean"},
                "has_property": {"type": "boolean"},
                "composition": {
                    "properties": {
                        "label": {"type": "keyword", "ignore_above": 256},
                        "species": {
                            "properties": {
                                "symbol": {"type": "keyword"},
                                "value": {"type": "float"},
                                "unit": {"type": "keyword"},
                            }
                        },
                        "elements": {
                            "properties": {
                                "symbol": {"type": "keyword"},
                                "at_pct": {"type": "float"},
                            }
                        },
                        "canonical": {"type": "keyword", "ignore_above": 512},
                        "vector": {
                            "type": "knn_vector",
                            "dimension": 118,
                            "method": {"name": "hnsw", "space_type": "l2", "engine": "lucene"},
                        },
                    }
                },
                "property": {
                    "properties": {
                        "raw": {"type": "text", "analyzer": "omat_text"},
                        "name": {"type": "text", "analyzer": "omat_text"},
                        "slug": {"type": "keyword"},
                        "value": {"type": "double"},
                        "unit": {"type": "keyword"},
                        "value_si": {"type": "double"},
                    }
                },
                "elements": {"type": "keyword"},  # expanded atoms, sorted
                "species": {"type": "keyword"},  # as-written, e.g. B2O3
                "journal": {
                    "properties": {
                        "raw": {"type": "keyword", "ignore_above": 256},
                        "name": {
                            "type": "text",
                            "analyzer": "omat_text",
                            "fields": {"kw": {"type": "keyword"}},
                        },
                        "slug": {"type": "keyword"},
                    }
                },
                "year": {"type": "integer"},
                "applications": {
                    "properties": {
                        "raw": {"type": "keyword", "ignore_above": 128},
                        "slug": {"type": "keyword"},
                    }
                },
                "search_text": {"type": "text", "analyzer": "omat_text"},
                # Enrichment (Crossref / Valency) adds these later; declared now
                # so dynamic:strict does not reject the enrich worker.
                "title": {"type": "text", "analyzer": "omat_text"},
                "abstract": {"type": "text", "analyzer": "omat_text"},
                "authors": {"type": "keyword"},
                "related_papers": {"type": "keyword"},  # external ids from Valency
            },
        },
    }
