"""Suggest DSL tests (structural: the query shape, not the backend)."""

from omat_core.opensearch.suggest import build_suggest_body, reduce_suggest_response


def test_element_prefix_uses_symbol_case() -> None:
    """Regression: `elements` is a case-sensitive keyword field ("Ti"), so an
    uppercased prefix ("TI") matched nothing — the element arm was dead."""
    for q in ("ti", "Ti", "TI", "t"):
        body = build_suggest_body(q)
        element_clauses = [
            clause
            for clause in body["query"]["bool"]["should"]
            if "prefix" in clause and "elements" in clause["prefix"]
        ]
        assert len(element_clauses) == 1, q
        expected = q[:1].upper() + q[1:].lower()
        assert element_clauses[0]["prefix"]["elements"]["value"] == expected, q


def test_other_arms_keep_user_casing() -> None:
    body = build_suggest_body("hard")
    should = body["query"]["bool"]["should"]
    assert should[0]["match_bool_prefix"]["composition.canonical"]["query"] == "hard"
    assert should[2]["match_bool_prefix"]["property.name"]["query"] == "hard"
    assert should[3]["match_bool_prefix"]["journal.name"]["query"] == "hard"


def test_reduce_buckets() -> None:
    response = {
        "aggregations": {
            "formulas": {"buckets": [{"key": "Al50-Ti50", "doc_count": 1}]},
            "elements": {"buckets": []},
            "properties": {"buckets": [{"key": "hardness", "doc_count": 3}]},
            "journals": {"buckets": []},
        }
    }
    assert reduce_suggest_response("hard", response) == {
        "query": "hard",
        "formulas": ["Al50-Ti50"],
        "elements": [],
        "properties": ["hardness"],
        "journals": [],
    }
