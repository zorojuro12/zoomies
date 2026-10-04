"""spec_defs: Python's copy of the dog spec rules (ranges, defaults, normalisation). The TypeScript
side (dog-spec.ts) is the source of truth; spec-ranges.json is checked against it by a vitest test,
so this module only has to behave like normalizeSpec."""
import copy
import json

from zoomies_pipeline import spec_defs as sd


def test_default_spec_is_the_neutral_template():
    assert sd.DEFAULT_SPEC["size"] == 1
    assert all(v == 1 for v in sd.DEFAULT_SPEC["proportions"].values())
    assert sd.DEFAULT_SPEC["earType"] == "semi" and sd.DEFAULT_SPEC["tailType"] == "long"


def test_normalize_turns_junk_into_the_default_dog():
    assert sd.normalize_spec({}) == sd.DEFAULT_SPEC
    assert sd.normalize_spec(None) == sd.DEFAULT_SPEC
    assert sd.normalize_spec("banana") == sd.DEFAULT_SPEC
    assert sd.normalize_spec([1, 2]) == sd.DEFAULT_SPEC


def test_normalize_keeps_valid_values():
    s = sd.normalize_spec(
        {"name": "Rex", "size": 1.2, "proportions": {"legLength": 0.8}, "earType": "floppy", "tailType": "stub"}
    )
    assert s["name"] == "Rex" and s["size"] == 1.2
    assert s["proportions"]["legLength"] == 0.8 and s["proportions"]["bodyLength"] == 1
    assert s["earType"] == "floppy" and s["tailType"] == "stub"


def test_normalize_clamps_numbers_to_the_safe_range():
    s = sd.normalize_spec({"size": 99, "proportions": {"legLength": -5, "snoutLength": 99}})
    assert s["size"] == sd.RANGES["size"][1]
    assert s["proportions"]["legLength"] == sd.RANGES["legLength"][0]
    assert s["proportions"]["snoutLength"] == sd.RANGES["snoutLength"][1]


def test_normalize_replaces_non_numbers_nan_and_booleans_with_the_default():
    s = sd.normalize_spec({"size": "big", "proportions": {"legLength": float("nan"), "headSize": None, "earSize": True}})
    assert s["size"] == 1 and s["proportions"]["legLength"] == 1
    assert s["proportions"]["headSize"] == 1 and s["proportions"]["earSize"] == 1


def test_normalize_accepts_numeric_strings_from_a_model():
    assert sd.normalize_spec({"proportions": {"legLength": "0.8"}})["proportions"]["legLength"] == 0.8


def test_normalize_unknown_ear_and_tail_types_fall_back():
    s = sd.normalize_spec({"earType": "antlers", "tailType": "wings"})
    assert s["earType"] == sd.DEFAULT_SPEC["earType"] and s["tailType"] == sd.DEFAULT_SPEC["tailType"]


def test_normalize_colours_valid_hex_lowercased_bad_replaced():
    s = sd.normalize_spec({"colors": {"coat": "#AABBCC", "chest": "purple-ish", "nose": 42, "eyes": "#12345"}})
    assert s["colors"]["coat"] == "#aabbcc"
    assert s["colors"]["chest"] == sd.DEFAULT_SPEC["colors"]["chest"]
    assert s["colors"]["nose"] == sd.DEFAULT_SPEC["colors"]["nose"]
    assert s["colors"]["eyes"] == sd.DEFAULT_SPEC["colors"]["eyes"]


def test_normalize_ignores_unknown_keys_and_never_mutates_input():
    raw = {"size": 1.1, "wings": True, "colors": {"coat": "#abcdef", "sparkle": "#fff000"}}
    before = copy.deepcopy(raw)
    s = sd.normalize_spec(raw)
    assert raw == before
    assert "wings" not in s and "sparkle" not in s["colors"]


def test_normalize_output_has_a_fixed_key_order_like_the_editor_writes():
    assert list(sd.normalize_spec({}).keys()) == ["name", "sourcePhoto", "size", "proportions", "earType", "tailType", "colors"]
    assert list(sd.normalize_spec({})["proportions"].keys()) == sd.PROPORTION_KEYS


def test_every_key_has_a_range_and_the_shared_file_loads():
    for k in ["size", *sd.PROPORTION_KEYS]:
        lo, hi = sd.RANGES[k]
        assert lo < hi
    assert json.loads(json.dumps(sd.normalize_spec({}))) == sd.normalize_spec({})
