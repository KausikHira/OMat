"""Query interpretation and NL-aware search DSL.

Regression tests for natural-language questions like the riverbed/house
example: conversational filler must be dropped, domain words must map to the
curated taxonomy (data/taxonomy/intents.yaml), and technical queries must
pass through untouched.
"""

from omat_core.opensearch import build_search_query
from omat_core.query_interpret import interpret_query

NL = "I want to make a house near a riverbed what type of concrete should I use"


def test_nl_question_maps_to_application_facet():
    interp = interpret_query(NL)
    assert "structural-mechanical" in interp.application_slugs
    assert interp.property_slugs == ()
    tokens = set(interp.text.lower().split())
    for filler in ("i", "want", "make", "type", "should", "use", "near"):
        assert filler not in tokens
    assert "concrete" in interp.text
    # synonym expansion from intents.yaml: concrete -> cement, mortar
    assert "cement" in interp.text and "mortar" in interp.text


def test_technical_query_passes_through():
    interp = interpret_query("TiAl70CrN B2O3")
    assert interp.text == "TiAl70CrN B2O3"
    assert interp.application_slugs == () and interp.property_slugs == ()
    assert interp.matched_words == ()


def test_original_case_is_preserved():
    # Lowercasing would break the standard tokenizer: "TiAlN" -> TiAl + N,
    # "tialn" -> one token that matches nothing.
    interp = interpret_query("TiAlN Youngs modulus")
    assert "TiAlN" in interp.text


def test_single_token_query_survives():
    # minimum_should_match: 2 in the old DSL returned zero hits for this.
    interp = interpret_query("concrete")
    assert interp.text
    assert "structural-mechanical" in interp.application_slugs


def test_property_and_application_intents():
    interp = interpret_query("lightweight and stiff material for a coating")
    assert "youngs_modulus" in interp.property_slugs
    assert "density" in interp.property_slugs
    assert "coatings-barriers" in interp.application_slugs


def test_phrase_trigger():
    interp = interpret_query("best material for fuel cell membranes")
    assert "fuel-cells" in interp.application_slugs


def test_all_filler_falls_back_to_raw_query():
    interp = interpret_query("what should I use")
    assert interp.text == "what should I use"
    assert interp.application_slugs == () and interp.property_slugs == ()


def test_empty_query():
    assert interpret_query("").text == ""
    assert interpret_query(None).text == ""


def test_nl_query_dsl_shape():
    query = build_search_query(NL, {})
    should = query["bool"]["must"][0]["bool"]["should"]
    assert should[0]["multi_match"]["query"] == ("house riverbed concrete cement mortar")
    assert should[0]["multi_match"]["operator"] == "or"
    facet_terms = [c["term"] for c in should[1:] if "term" in c]
    assert any(t["applications.slug"]["value"] == "structural-mechanical" for t in facet_terms)
    assert all(t["applications.slug"]["boost"] > 1 for t in facet_terms)


def test_technical_dsl_has_no_facet_clauses():
    query = build_search_query("TiAl70CrN B2O3", {})
    must = query["bool"]["must"]
    assert len(must) == 1
    should = must[0]["bool"]["should"]
    assert len(should) == 1  # only the multi_match, no facet boosts
    assert should[0]["multi_match"]["query"] == "TiAl70CrN B2O3"


def test_domain_word_boosts_its_facet():
    # "coating" is a domain word: mapped to the coatings-barriers facet.
    query = build_search_query("TiAlN coating", {})
    should = query["bool"]["must"][0]["bool"]["should"]
    facet_terms = [c["term"] for c in should if "term" in c]
    assert any(t["applications.slug"]["value"] == "coatings-barriers" for t in facet_terms)
    # facet boost is a ranking signal, not a filter
    assert query["bool"]["filter"] == []


def test_explicit_filters_still_and_across_fields():
    query = build_search_query("TiAlN", {"elements": ["Ti", "Al"]})
    assert query["bool"]["filter"] == [{"terms": {"elements": ["Ti", "Al"]}}]


def test_no_query_is_match_all():
    query = build_search_query(None, {})
    assert query["bool"]["must"] == [{"match_all": {}}]
    assert query["bool"]["filter"] == []
