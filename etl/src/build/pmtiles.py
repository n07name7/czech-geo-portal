import json
import subprocess
import tempfile
from pathlib import Path
import h3


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


def build_pmtiles(scores: dict[str, float], output_path: Path, layer_name: str = "cells") -> Path:
    """
    Convert H3 scores dict to a PMTiles file at output_path.
    Requires tippecanoe to be installed.
    """
    geojson = cells_to_geojson(scores)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".geojson", delete=False) as f:
        json.dump(geojson, f)
        tmp_path = Path(f.name)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        "tippecanoe",
        "-o", str(output_path),
        "--force",
        "-Z", "7",
        "-z", "14",
        "-l", layer_name,
        "--no-tile-compression",
        str(tmp_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    tmp_path.unlink(missing_ok=True)

    if result.returncode != 0:
        raise RuntimeError(f"tippecanoe failed:\n{result.stderr}")

    return output_path
