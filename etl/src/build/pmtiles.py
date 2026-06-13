import json
import subprocess
import tempfile
from collections import defaultdict
from pathlib import Path
import h3

# Resolution per zoom band. H3 res-10 hexes (~150 m across) are sub-pixel
# below z13, so coarser parent cells render at lower zooms — hexes stay
# ~10-40 px on screen at every zoom instead of dissolving into noise.
#
# Each band is built as its own tileset with hard -Z/-z bounds and merged
# with tile-join: per-feature tippecanoe minzoom/maxzoom attributes make
# tippecanoe drop polygons probabilistically ("dropped_by_rate"), losing
# most cells — hard zoom bounds keep every feature.
RES_ZOOM_BANDS: list[tuple[int, int, int, str]] = [
    # (h3_res, tile_minzoom, tile_maxzoom, aggregation)
    # Coarse zooms are locators — "max" keeps hotspots visible; "mean" on a
    # 6 km cell with one strong centre and empty outskirts is near-invisible.
    (6,  5,  7, "max"),
    (7,  8,  8, "max"),
    (8,  9, 10, "mean"),
    (9, 11, 11, "mean"),
    (10, 12, 14, "base"),
]

BASE_RES = 10


def aggregate_to_parent(
    scores: dict[str, float],
    parent_res: int,
    mode: str = "mean",
) -> dict[str, float]:
    """Aggregate child scores per parent cell (keeps the 0-1 range)."""
    groups: dict[str, list[float]] = defaultdict(list)
    for cell_id, score in scores.items():
        groups[h3.cell_to_parent(cell_id, parent_res)].append(score)
    if mode == "max":
        return {p: max(v) for p, v in groups.items()}
    return {p: sum(v) / len(v) for p, v in groups.items()}


def cells_to_geojson(scores: dict[str, float]) -> dict:
    """Convert {cell_id: score} to a GeoJSON FeatureCollection of H3 hex polygons."""
    features = []
    for cell_id, score in scores.items():
        # h3.cell_to_boundary returns list of (lat, lon) — GeoJSON needs (lon, lat)
        boundary = h3.cell_to_boundary(cell_id)
        coords = [[lon, lat] for lat, lon in boundary]
        coords.append(coords[0])  # close ring
        features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [coords]},
            "properties": {"score": round(score, 4), "cell": cell_id},
        })
    return {"type": "FeatureCollection", "features": features}


def aggregate_props_to_parent(
    cell_props: dict[str, dict[str, float]],
    parent_res: int,
) -> dict[str, dict[str, float]]:
    """Mean of each layer score per parent cell."""
    sums: dict[str, dict[str, float]] = {}
    counts: dict[str, int] = {}
    for cell_id, props in cell_props.items():
        parent = h3.cell_to_parent(cell_id, parent_res)
        acc = sums.setdefault(parent, {})
        for layer, score in props.items():
            acc[layer] = acc.get(layer, 0.0) + score
        counts[parent] = counts.get(parent, 0) + 1
    return {
        p: {layer: total / counts[p] for layer, total in acc.items()}
        for p, acc in sums.items()
    }


def combined_to_geojson(cell_props: dict[str, dict[str, float]]) -> dict:
    """One feature per cell carrying every layer score as a property."""
    features = []
    for cell_id, props in cell_props.items():
        boundary = h3.cell_to_boundary(cell_id)
        coords = [[lon, lat] for lat, lon in boundary]
        coords.append(coords[0])
        properties = {"cell": cell_id}
        properties.update({layer: round(score, 3) for layer, score in props.items()})
        features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [coords]},
            "properties": properties,
        })
    return {"type": "FeatureCollection", "features": features}


def _run(cmd: list[str]) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed:\n{result.stderr[-2000:]}")


def build_pmtiles(scores: dict[str, float], output_path: Path, layer_name: str = "cells") -> Path:
    """
    Convert H3 res-10 scores to a multi-resolution PMTiles file at output_path.
    Requires tippecanoe (with tile-join) to be installed.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        band_files: list[str] = []

        for res, minzoom, maxzoom, agg in RES_ZOOM_BANDS:
            level = scores if agg == "base" else aggregate_to_parent(scores, res, agg)
            geojson_path = tmp / f"res{res}.geojson"
            with open(geojson_path, "w") as f:
                json.dump(cells_to_geojson(level), f)

            band_path = tmp / f"res{res}.mbtiles"
            _run([
                "tippecanoe",
                "-o", str(band_path),
                "--force",
                "-Z", str(minzoom),
                "-z", str(maxzoom),
                "-l", layer_name,
                "--no-tiny-polygon-reduction",
                "--detect-shared-borders",
                str(geojson_path),
            ])
            band_files.append(str(band_path))

        _run([
            "tile-join",
            "-o", str(output_path),
            "--force",
            "--no-tile-compression",
            *band_files,
        ])

    return output_path


def build_combined_pmtiles(
    cell_props: dict[str, dict[str, float]],
    output_path: Path,
    layer_name: str = "cells",
) -> Path:
    """Multi-resolution PMTiles where each cell carries all layer scores.

    Drives the client-side "match by weights" mode: MapLibre computes the
    weighted blend from feature properties, so weights update instantly
    with no refetch.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        band_files: list[str] = []

        for res, minzoom, maxzoom, agg in RES_ZOOM_BANDS:
            level = cell_props if agg == "base" else aggregate_props_to_parent(cell_props, res)
            geojson_path = tmp / f"res{res}.geojson"
            with open(geojson_path, "w") as f:
                json.dump(combined_to_geojson(level), f)

            band_path = tmp / f"res{res}.mbtiles"
            _run([
                "tippecanoe",
                "-o", str(band_path),
                "--force",
                "-Z", str(minzoom),
                "-z", str(maxzoom),
                "-l", layer_name,
                "--no-tiny-polygon-reduction",
                "--detect-shared-borders",
                str(geojson_path),
            ])
            band_files.append(str(band_path))

        _run([
            "tile-join",
            "-o", str(output_path),
            "--force",
            "--no-tile-compression",
            *band_files,
        ])

    return output_path
