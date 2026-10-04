"""colors: snap a model's colours to the photo's real colours. Gemini decides WHICH colour goes
WHERE; the photo supplies the exact paint, so we never use a colour that isn't on the dog."""
import numpy as np
import pytest
from PIL import Image

from zoomies_pipeline import colors as co


def test_hex_rgb_round_trip():
    assert co.hex_to_rgb("#ff8000") == (255, 128, 0)
    assert co.rgb_to_hex((255, 128, 0)) == "#ff8000"
    assert co.hex_to_rgb("#ABCDEF") == (171, 205, 239)


@pytest.mark.parametrize("bad", ["ff8000", "#12345", "#gggggg", "red", 5, None])
def test_hex_to_rgb_rejects_junk(bad):
    with pytest.raises(ValueError):
        co.hex_to_rgb(bad)


def test_delta_e_identical_is_zero_and_black_to_white_is_about_100():
    assert co.delta_e("#336699", "#336699") == pytest.approx(0, abs=1e-6)
    assert 99 < co.delta_e("#000000", "#ffffff") < 101  # CIE76: lightness runs 0..100


def test_delta_e_orders_colours_sensibly():
    assert co.delta_e("#ff0000", "#f01010") < co.delta_e("#ff0000", "#0000ff")


def test_snap_moves_a_colour_to_the_nearest_photo_colour():
    assert co.snap_color("#e03030", ["#ff0000", "#0000ff"]) == "#ff0000"
    assert co.snap_color("#3030e0", ["#ff0000", "#0000ff"]) == "#0000ff"


def test_snap_keeps_the_original_when_nothing_in_the_photo_is_close():
    assert co.snap_color("#00ff00", ["#ff0000", "#0000ff"], max_delta=35) == "#00ff00"


def test_snap_with_an_empty_palette_changes_nothing():
    assert co.snap_color("#123456", []) == "#123456"


def test_snap_colors_reports_what_changed():
    snapped, changes = co.snap_colors({"coat": "#e03030", "eyes": "#00ff00"}, ["#ff0000"])
    assert snapped == {"coat": "#ff0000", "eyes": "#00ff00"}
    assert changes == {"coat": ("#e03030", "#ff0000")}


def synthetic(tmp_path):
    """100x100: a grey studio background with a red left half and a blue right half inside it."""
    img = Image.new("RGB", (100, 100), (138, 143, 148))
    for x in range(20, 50):
        for y in range(20, 80):
            img.putpixel((x, y), (200, 0, 0))
    for x in range(50, 80):
        for y in range(20, 80):
            img.putpixel((x, y), (0, 0, 200))
    p = tmp_path / "dog.png"
    img.save(p)
    return img, p


def test_dominant_colors_finds_the_subject_and_ignores_the_background(tmp_path):
    img, _ = synthetic(tmp_path)
    palette = co.dominant_colors(img, k=4)
    assert any(co.delta_e(c, "#c80000") < 10 for c in palette), palette
    assert any(co.delta_e(c, "#0000c8") < 10 for c in palette), palette
    assert not any(co.delta_e(c, "#8a8f94") < 10 for c in palette), palette  # grey backdrop dropped


def test_dominant_colors_is_deterministic(tmp_path):
    img, _ = synthetic(tmp_path)
    assert co.dominant_colors(img, k=4) == co.dominant_colors(img, k=4)


def test_dominant_colors_of_a_plain_image_does_not_crash():
    assert isinstance(co.dominant_colors(Image.new("RGB", (20, 20), (10, 10, 10)), k=3), list)


def test_foreground_mask_marks_the_subject_not_the_border(tmp_path):
    img, _ = synthetic(tmp_path)
    mask = co.foreground_mask(np.asarray(img))
    assert mask[50, 35] and mask[50, 65]      # inside the red and blue halves
    assert not mask[2, 2] and not mask[97, 97]  # corners are background
