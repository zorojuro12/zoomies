"""photo_to_spec: ask Gemini (several times, in parallel, with a timeout), take the middle answer,
snap the colours to the photo, and always end up with a valid spec — even if every call fails.
Gemini is faked here; the real call is exercised by hand."""
import time

from PIL import Image

from zoomies_pipeline import photo_to_spec as p2s
from zoomies_pipeline import spec_defs as sd


def make_photo(tmp_path):
    img = Image.new("RGB", (100, 100), (138, 143, 148))
    for x in range(20, 80):
        for y in range(20, 80):
            img.putpixel((x, y), (200, 0, 0))
    path = tmp_path / "dog.png"
    img.save(path)
    return path


def answer(leg, **extra):
    s = {"proportions": {"legLength": leg}, "earType": "floppy"}
    s.update(extra)
    return s


def seq(*answers):
    """A fake `ask` that returns the given answers one per call (thread-safe enough for tests)."""
    it = iter(answers)

    def ask(image_bytes, mime):
        a = next(it)
        if isinstance(a, Exception):
            raise a
        return a

    return ask


def test_takes_the_median_of_the_calls_and_reports_it(tmp_path):
    res = p2s.photo_to_spec(make_photo(tmp_path), "rex", ask=seq(answer(0.9), answer(1.0), answer(1.6)), calls=3, snap=False)
    assert res.spec["proportions"]["legLength"] == 1.0
    assert res.spec["name"] == "rex" and res.spec["earType"] == "floppy"
    assert res.report["calls_ok"] == 3 and res.report["calls_failed"] == 0 and not res.report["fallback"]


def test_the_result_is_always_a_valid_normalised_spec(tmp_path):
    res = p2s.photo_to_spec(make_photo(tmp_path), "rex", ask=seq(answer(99), answer(-4), answer("x")), calls=3, snap=False)
    assert sd.normalize_spec(res.spec) == res.spec


def test_one_failing_call_does_not_stop_the_others(tmp_path):
    res = p2s.photo_to_spec(make_photo(tmp_path), "rex", ask=seq(answer(0.8), RuntimeError("503"), answer(1.2)), calls=3, snap=False)
    assert res.report["calls_ok"] == 2 and res.report["calls_failed"] == 1
    assert "503" in res.report["errors"][0]
    assert res.spec["proportions"]["legLength"] == 1.0  # median of 0.8 and 1.2


def test_a_non_dict_answer_counts_as_a_failure(tmp_path):
    res = p2s.photo_to_spec(make_photo(tmp_path), "rex", ask=seq(answer(1.0), "not json", None), calls=3, snap=False)
    assert res.report["calls_ok"] == 1 and res.report["calls_failed"] == 2


def test_all_calls_failing_falls_back_to_the_default_spec(tmp_path):
    boom = RuntimeError("quota")
    res = p2s.photo_to_spec(make_photo(tmp_path), "rex", ask=seq(boom, boom, boom), calls=3, snap=False)
    assert res.report["fallback"] is True and res.report["calls_ok"] == 0
    assert res.spec == {**sd.DEFAULT_SPEC, "name": "rex"}


def test_a_hanging_call_is_abandoned_after_the_timeout(tmp_path):
    def slow(image_bytes, mime):
        time.sleep(2)
        return answer(1.0)

    t0 = time.time()
    res = p2s.photo_to_spec(make_photo(tmp_path), "rex", ask=slow, calls=2, timeout_s=0.3, snap=False)
    assert time.time() - t0 < 1.5
    assert res.report["fallback"] is True and res.report["calls_failed"] == 2


def test_calls_run_in_parallel(tmp_path):
    def nap(image_bytes, mime):
        time.sleep(0.3)
        return answer(1.0)

    t0 = time.time()
    p2s.photo_to_spec(make_photo(tmp_path), "rex", ask=nap, calls=3, timeout_s=5, snap=False)
    assert time.time() - t0 < 0.8  # ~0.3 s, not 0.9 s


def test_colours_are_snapped_to_the_photos_real_colours(tmp_path):
    res = p2s.photo_to_spec(make_photo(tmp_path), "rex", ask=lambda b, m: answer(1.0, colors={"coat": "#e03030"}), calls=1)
    assert sd_delta(res.spec["colors"]["coat"], "#c80000") < 10
    assert res.report["snapped"]["coat"][0] == "#e03030"


def sd_delta(a, b):
    from zoomies_pipeline import colors

    return colors.delta_e(a, b)


def test_the_source_photo_path_is_recorded(tmp_path):
    res = p2s.photo_to_spec(make_photo(tmp_path), "rex", ask=lambda b, m: answer(1.0), calls=1, snap=False, source_photo="photo/dog.jpeg")
    assert res.spec["sourcePhoto"] == "photo/dog.jpeg"


def test_the_prompt_and_schema_cover_every_spec_field():
    schema = p2s.RESPONSE_SCHEMA
    assert set(schema["properties"]["proportions"]["properties"]) == set(sd.PROPORTION_KEYS)
    assert set(schema["properties"]["colors"]["properties"]) == set(sd.COLOR_KEYS)
    assert set(schema["properties"]["earType"]["enum"]) == set(sd.EAR_TYPES)
    assert set(schema["properties"]["tailType"]["enum"]) == set(sd.TAIL_TYPES)
    assert "1.0" in p2s.PROMPT  # tells the model what a typical dog scores
