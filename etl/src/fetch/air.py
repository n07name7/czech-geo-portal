"""Air quality: 5-year average PM2.5 concentration (ČHMÚ, 1×1 km grid).

Source: opendata.chmi.cz five-year average maps (2019-2023), shapefile in
S-JTSK. Polygons carry annual-mean concentrations; we use PM2.5 (µg/m³) as
the primary health indicator. Open data.
"""
import io
import zipfile

import requests
import shapefile  # pyshp
from pyproj import Transformer
from shapely.geometry import shape

ZIP_URL = (
    "https://opendata.chmi.cz/air_quality/products/5year_avg/"
    "sit1000_5lprum_19_23_CR_JTSK.zip"
)
SHP_NAME = "petileti19-23_CR_rp_-_podle_zakona_201/sit1000_5lprum_19_23_JTSK_rp.shp"
PM25_FIELD = "PM25_rp_5l"

_TO_SJTSK = Transformer.from_crs("EPSG:4326", "EPSG:5514", always_xy=True)

# all (shapely polygon in S-JTSK, pm25), parsed once per run
_grid: list[tuple[object, float]] | None = None


def _load_grid() -> list[tuple[object, float]]:
    global _grid
    if _grid is not None:
        return _grid

    raw = requests.get(ZIP_URL, timeout=300).content
    zf = zipfile.ZipFile(io.BytesIO(raw))

    base = SHP_NAME[:-4]
    reader = shapefile.Reader(
        shp=io.BytesIO(zf.read(base + ".shp")),
        dbf=io.BytesIO(zf.read(base + ".dbf")),
        shx=io.BytesIO(zf.read(base + ".shx")),
    )
    fields = [f[0] for f in reader.fields[1:]]
    pm25_idx = fields.index(PM25_FIELD)

    grid: list[tuple[object, float]] = []
    for sr in reader.iterShapeRecords():
        pm25 = sr.record[pm25_idx]
        if pm25 is None:
            continue
        try:
            grid.append((shape(sr.shape.__geo_interface__), float(pm25)))
        except (ValueError, AttributeError):
            continue
    _grid = grid
    return _grid


def fetch_air(
    bbox: tuple[float, float, float, float],
) -> list[tuple[object, float]]:
    """Return (polygon S-JTSK, PM2.5 µg/m³) for grid cells overlapping bbox."""
    south, west, north, east = bbox
    xs, ys = _TO_SJTSK.transform([west, east, west, east], [south, south, north, north])
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    out = []
    for poly, pm25 in _load_grid():
        pxmin, pymin, pxmax, pymax = poly.bounds
        if pxmax < xmin or pxmin > xmax or pymax < ymin or pymin > ymax:
            continue
        out.append((poly, pm25))
    return out
