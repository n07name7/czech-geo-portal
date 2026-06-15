"""Strategic noise map polygons (SHM 2022, Ministry of Health geoportal).

Source: geoportal.mzcr.cz INSPIRE FeatureServer — Lden noise bands as
polygons per EU directive 2002/49/ES. Agglomeration layers cover the big
cities with all sources combined; country-wide road and railway layers
cover everything else. Queried in native S-JTSK, returned as WGS84.
"""
import requests
from pyproj import Transformer
from shapely.geometry import shape

FEATURE_SERVER = (
    "https://geoportal.mzcr.cz/server/rest/services/SHM2022/INSPIRE/FeatureServer"
)

# Aglomerace_Celek_Ldvn (all sources, big cities), Silnice_Ldvn and
# Zeleznice_Ldvn (roads/railways, whole country). Max dB wins per cell,
# so overlap between layers is harmless.
LAYER_IDS = [0, 12, 14]
# Matching night-only (Lnight / "_Ln_2022") layers, for the day-vs-night split.
NIGHT_LAYER_IDS = [1, 13, 15]

PAGE_SIZE = 2000

# The 50-55 dB band has by far the largest polygons and carries little
# signal (≈ normal city background); skipping it keeps downloads sane.
WHERE = "DB_Int <> '50 - 55 dB'"

_TO_SJTSK = Transformer.from_crs("EPSG:4326", "EPSG:5514", always_xy=True)


def _db_mid(db_int: str) -> float:
    """'55 - 60 dB' → 57.5"""
    low = float(db_int.split(" ")[0])
    return low + 2.5


def _query_layer(
    layer_id: int,
    envelope: str,
) -> list[tuple[object, float]]:
    polys: list[tuple[object, float]] = []
    offset = 0
    while True:
        r = requests.get(
            f"{FEATURE_SERVER}/{layer_id}/query",
            params={
                "geometry": envelope,
                "geometryType": "esriGeometryEnvelope",
                "inSR": 5514,
                "spatialRel": "esriSpatialRelIntersects",
                "where": WHERE,
                "outFields": "DB_Int",
                "outSR": 4326,
                "resultOffset": offset,
                "resultRecordCount": PAGE_SIZE,
                "f": "geojson",
            },
            timeout=300,
        )
        r.raise_for_status()
        data = r.json()
        features = data.get("features", [])
        for f in features:
            db_int = (f.get("properties") or {}).get("DB_Int")
            geom = f.get("geometry")
            if not db_int or not geom:
                continue
            try:
                polys.append((shape(geom), _db_mid(db_int)))
            except (ValueError, KeyError):
                continue
        if not data.get("properties", {}).get("exceededTransferLimit") and not data.get(
            "exceededTransferLimit"
        ):
            break
        if not features:
            break
        offset += PAGE_SIZE
    return polys


def fetch_noise_polygons(
    bbox: tuple[float, float, float, float],
    layer_ids: list[int] | None = None,
) -> list[tuple[object, float]]:
    """Return [(shapely polygon WGS84, representative dB), ...] for bbox.

    Defaults to the Lden (day-evening-night) layers; pass NIGHT_LAYER_IDS for
    the night-only (Lnight) maps.
    """
    south, west, north, east = bbox
    x1, y1 = _TO_SJTSK.transform(west, south)
    x2, y2 = _TO_SJTSK.transform(east, north)
    xmin, xmax = sorted([x1, x2])
    ymin, ymax = sorted([y1, y2])
    envelope = f"{xmin},{ymin},{xmax},{ymax}"

    polys: list[tuple[object, float]] = []
    for layer_id in (layer_ids or LAYER_IDS):
        polys.extend(_query_layer(layer_id, envelope))
    return polys
