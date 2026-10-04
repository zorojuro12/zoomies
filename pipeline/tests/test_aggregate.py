"""aggregate: combine several Gemini answers into one robust spec. Numbers: the MEDIAN (one wild
answer cannot win). Ear/tail types: majority vote. Colours: per-channel median in RGB."""
import pytest

from zoomies_pipeline import aggregate as ag
from zoomies_pipeline import spec_defs as sd


def spec(**over):
    s = sd.normalize_spec({})
    props = over.pop("proportions", {})
    cols = over.pop("colors", {})
    s["proportions"].update(props)
    s["colors"].update(cols)
    s.update(over)
    return s


def test_median_of_odd_and_even_counts():
    assert ag.median([1, 3, 2]) == 2
    assert ag.median([1, 2, 3, 10]) == 2.5  # (2 + 3) / 2


def test_median_of_one_value_and_empty_input():
    assert ag.median([7]) == 7
    with pytest.raises(ValueError):
        ag.median([])


def test_one_wild_answer_does_not_win_the_numbers():
    out = ag.aggregate_specs(
        [spec(proportions={"legLength": 0.9}), spec(proportions={"legLength": 1.0}), spec(proportions={"legLength": 1.6})]
    )
    assert out["proportions"]["legLength"] == 1.0


def test_size_is_also_a_median():
    out = ag.aggregate_specs([spec(size=0.8), spec(size=1.0), spec(size=1.4)])
    assert out["size"] == 1.0


def test_ear_and_tail_type_use_a_majority_vote():
    out = ag.aggregate_specs([spec(earType="floppy", tailType="stub"), spec(earType="floppy", tailType="long"), spec(earType="pointy", tailType="long")])
    assert out["earType"] == "floppy" and out["tailType"] == "long"


def test_a_three_way_tie_goes_to_the_first_answer():
    out = ag.aggregate_specs([spec(earType="pointy"), spec(earType="semi"), spec(earType="floppy")])
    assert out["earType"] == "pointy"


def test_colours_are_medianed_per_channel_hand_worked():
    # R: 0, 100, 200 -> 100 (0x64); G: 0, 100, 50 -> 50 (0x32); B: 0, 100, 10 -> 10 (0x0a)
    out = ag.aggregate_specs(
        [spec(colors={"coat": "#000000"}), spec(colors={"coat": "#646464"}), spec(colors={"coat": "#c8320a"})]
    )
    assert out["colors"]["coat"] == "#64320a"


def test_two_agreeing_colours_beat_one_outlier():
    out = ag.aggregate_specs([spec(colors={"nose": "#101010"}), spec(colors={"nose": "#101010"}), spec(colors={"nose": "#ffffff"})])
    assert out["colors"]["nose"] == "#101010"


def test_a_single_answer_comes_back_unchanged():
    s = spec(earType="floppy", proportions={"legLength": 0.7})
    assert ag.aggregate_specs([s]) == s


def test_no_answers_is_an_error():
    with pytest.raises(ValueError):
        ag.aggregate_specs([])


def test_the_result_is_a_valid_normalised_spec_and_inputs_are_untouched():
    a, b = spec(size=0.9), spec(size=1.1)
    before = (dict(a), dict(b))
    out = ag.aggregate_specs([a, b])
    assert sd.normalize_spec(out) == out
    assert (a, b) == before
