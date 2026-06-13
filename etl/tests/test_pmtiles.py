import shutil
from collections import Counter

import h3
import pytest
from src.build.pmtiles import aggregate_to_parent, cells_to_geojson, build_pmtiles, RES_ZOOM_BANDS


def _res10_cells_around(lat: float, lon: float, k: int = 2) -> list[str]:
    center = h3.latlng_to_cell(lat, lon, 10)
    return list(h3.grid_disk(center, k))


def test_aggregate_to_parent_means_children():
    cells = _res10_cells_around(50.08, 14.44)
    scores = {c: 0.5 for c in cells}
    parents = aggregate_to_parent(scores, 8)
    assert all(v == pytest.approx(0.5) for v in parents.values())
    assert all(h3.get_resolution(p) == 8 for p in parents)


def test_aggregate_keeps_range():
    cells = _res10_cells_around(50.08, 14.44, k=3)
    scores = {c: (i % 11) / 10 for i, c in enumerate(cells)}
    parents = aggregate_to_parent(scores, 7)
    assert all(0.0 <= v <= 1.0 for v in parents.values())


def test_cells_to_geojson_basic():
    cells = _res10_cells_around(50.08, 14.44)
    gj = cells_to_geojson({c: 0.7 for c in cells})
    assert len(gj["features"]) == len(cells)
    f = gj["features"][0]
    assert f["geometry"]["type"] == "Polygon"
    assert "cell" in f["properties"]
    assert 0.0 <= f["properties"]["score"] <= 1.0


@pytest.mark.skipif(shutil.which("tippecanoe") is None, reason="tippecanoe not installed")
def test_build_pmtiles_keeps_full_density(tmp_path):
    """Regression: per-feature tippecanoe minzoom dropped most polygons."""
    from pmtiles.reader import Reader, MmapSource, all_tiles

    cells = _res10_cells_around(50.08, 14.44, k=5)  # 91 cells
    scores = {c: 0.5 for c in cells}
    out = build_pmtiles(scores, tmp_path / "test.pmtiles")

    with open(out, "rb") as f:
        reader = Reader(MmapSource(f))
        header = reader.header()
        assert header["min_zoom"] == 5
        assert header["max_zoom"] == 14

        bytes_per_zoom: Counter = Counter()
        for zxy, data in all_tiles(reader.get_bytes):
            bytes_per_zoom[zxy[0]] += len(data)

    # every band must contain real data at its zooms
    for _, minzoom, maxzoom, _agg in RES_ZOOM_BANDS:
        assert bytes_per_zoom.get(minzoom, 0) > 0, f"no data at z{minzoom}"
        assert bytes_per_zoom.get(maxzoom, 0) > 0, f"no data at z{maxzoom}"

    # 91 res-10 hexes ≈ several KB at z14 — a few hundred bytes means they were dropped
    assert bytes_per_zoom[14] > 2000, f"z14 too small: {bytes_per_zoom[14]} bytes"
