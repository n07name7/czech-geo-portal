import shutil

import h3
import pytest
from src.build.pmtiles import (
    aggregate_props_to_parent,
    combined_to_geojson,
    build_combined_pmtiles,
)


def _cells(lat: float, lon: float, k: int = 3) -> list[str]:
    return list(h3.grid_disk(h3.latlng_to_cell(lat, lon, 10), k))


def test_aggregate_props_means_per_layer():
    cells = _cells(50.08, 14.44)
    props = {c: {"schools": 0.4, "quiet": 0.8} for c in cells}
    parents = aggregate_props_to_parent(props, 8)
    for p in parents.values():
        assert p["schools"] == pytest.approx(0.4)
        assert p["quiet"] == pytest.approx(0.8)


def test_combined_geojson_carries_all_layers():
    cells = _cells(50.08, 14.44)
    props = {c: {"schools": 0.5, "safety": 0.9} for c in cells}
    gj = combined_to_geojson(props)
    f = gj["features"][0]
    assert "cell" in f["properties"]
    assert f["properties"]["schools"] == 0.5
    assert f["properties"]["safety"] == 0.9


@pytest.mark.skipif(shutil.which("tippecanoe") is None, reason="tippecanoe not installed")
def test_build_combined_pmtiles(tmp_path):
    from pmtiles.reader import Reader, MmapSource, all_tiles
    from collections import Counter

    cells = _cells(50.08, 14.44, k=5)
    props = {c: {"schools": 0.5, "quiet": 0.7, "safety": 0.9} for c in cells}
    out = build_combined_pmtiles(props, tmp_path / "combined.pmtiles")

    with open(out, "rb") as f:
        reader = Reader(MmapSource(f))
        assert reader.header()["min_zoom"] == 5
        assert reader.header()["max_zoom"] == 14
        bytes_per_zoom: Counter = Counter()
        for zxy, data in all_tiles(reader.get_bytes):
            bytes_per_zoom[zxy[0]] += len(data)
    assert bytes_per_zoom[14] > 2000
    assert bytes_per_zoom[7] > 0
