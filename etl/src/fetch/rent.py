"""Rental price level per cadastral area (k.ú.).

Official, legal source: the Czech Ministry of Finance "Cenová mapa nájemního
bydlení" — a quarterly XLSX (CC BY 4.0) with the reference market rent per m²
for ~7600 cadastral territories, keyed by k.ú. code. ČÚZK RÚIAN ArcGIS serves
the matching k.ú. polygons (join is 100 % on the k.ú. code). We assign each H3
cell to its k.ú. and store the area rent (CZK/m²/month) — neighbourhood-level
granularity without scraping any listing portal.
"""
import io
import re

import openpyxl
import requests
from shapely.geometry import shape

MF_PAGE = (
    "https://mf.gov.cz/cs/rozpoctova-politika/podpora-projektoveho-rizeni/"
    "cenova-mapa/cenova-mapa-infografika"
)
MF_BASE = "https://mf.gov.cz"
CUZK_KU = (
    "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/7/query"
)
_HDRS = {"User-Agent": "Czech-Geo-Portal/1.0 (Python ETL)"}

# "Nájemné referenčního bytu za m²" repeats once per size category (1+kk…4+kk);
# the four blocks start at these columns. We average the available categories
# into one representative CZK/m² for the area.
_REF_COLS = [5, 15, 25, 35]

_mf_cache: tuple[dict[int, int], str] | None = None


def _latest_xlsx_url() -> tuple[str, str]:
    """Newest published quarter: (download URL, YYYY-MM-DD)."""
    html = requests.get(MF_PAGE, headers=_HDRS, timeout=60).text
    hrefs = re.findall(
        r'href="(/assets/attachments/(\d{4}-\d{2}-\d{2})_Cenova-mapa[^"]*\.xlsx)"',
        html,
    )
    if not hrefs:
        raise RuntimeError("MF cenová mapa: no xlsx link found")
    href, date = max(hrefs, key=lambda h: h[1])
    return MF_BASE + href, date


def load_mf_rent() -> tuple[dict[int, int], str]:
    """{k.ú. code: reference rent CZK/m²/month}, and the source quarter date."""
    global _mf_cache
    if _mf_cache is not None:
        return _mf_cache
    url, date = _latest_xlsx_url()
    data = requests.get(url, headers=_HDRS, timeout=180).content
    wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb["Cenové mapy nájemného"]
    rows = ws.iter_rows(values_only=True)
    next(rows)  # header
    rent: dict[int, int] = {}
    for r in rows:
        kod = r[3]
        if not isinstance(kod, int):
            continue
        refs = [r[c] for c in _REF_COLS if isinstance(r[c], (int, float))]
        if refs:
            rent[kod] = round(sum(refs) / len(refs))
    _mf_cache = (rent, date)
    return _mf_cache


def fetch_rent(
    bbox: tuple[float, float, float, float],
) -> tuple[list[tuple[object, int]], str]:
    """Return ([(k.ú. polygon WGS84, rent CZK/m²)], quarter) for k.ú. that
    intersect bbox and have a rent value."""
    rent_by_kod, quarter = load_mf_rent()
    south, west, north, east = bbox
    params = {
        "where": "1=1",
        "geometry": f"{west},{south},{east},{north}",
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "outSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "kod",
        "returnGeometry": "true",
        "f": "geojson",
    }
    gj = requests.get(CUZK_KU, params=params, headers=_HDRS, timeout=120).json()
    out: list[tuple[object, int]] = []
    for feat in gj.get("features", []):
        kod = (feat.get("properties") or {}).get("kod")
        if kod is None or int(kod) not in rent_by_kod:
            continue
        try:
            geom = shape(feat["geometry"])
        except Exception:
            continue
        if not geom.is_valid:
            geom = geom.buffer(0)
        out.append((geom, rent_by_kod[int(kod)]))
    return out, quarter
