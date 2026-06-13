"""
ETL orchestrator for Czech Geo Portal.

Run:
    python main.py           # full run, uploads to GitHub Releases
    python main.py --dry-run # skips upload (local testing)
    python main.py --city praha  # single city only

Fetches POIs for 8 Czech cities, scores H3 cells per city,
combines into one PMTiles file per layer covering all cities.
"""
import os
import sys
from pathlib import Path

import src.net  # noqa: F401  — force IPv4 (GitHub runners lack IPv6)
from src.fetch.osm import fetch_osm_pois
from src.fetch.msmt import fetch_msmt_pois
from src.fetch.nrpzs import fetch_nrpzs_pois
from src.fetch.gtfs import fetch_gtfs_stops
from src.fetch.noise import fetch_noise_polygons
from src.fetch.crime import fetch_crime_points
from src.score.h3_scorer import get_city_cells, score_cells
from src.score.noise_scorer import score_cells_quiet
from src.build.pmtiles import build_pmtiles, build_combined_pmtiles

OUTPUT_DIR = Path("output/cities")
RESOLUTION = 10

# ── City configs ──────────────────────────────────────────────────────────────
# bbox: (south, west, north, east)
CITIES: list[dict] = [
    {
        "id": "praha",
        "name": "Praha",
        "bbox": (49.94, 14.22, 50.18, 14.71),
        "center": [14.437, 50.073],
    },
    {
        "id": "brno",
        "name": "Brno",
        "bbox": (49.1099, 16.4280, 49.2944, 16.7278),
        "center": [16.608, 49.195],
    },
    {
        "id": "ostrava",
        "name": "Ostrava",
        "bbox": (49.7258, 18.0984, 49.9138, 18.3763),
        "center": [18.292, 49.820],
    },
    {
        "id": "plzen",
        "name": "Plzeň",
        "bbox": (49.6792, 13.2680, 49.8058, 13.4758),
        "center": [13.377, 49.738],
    },
    {
        "id": "liberec",
        "name": "Liberec",
        "bbox": (50.7080, 14.9530, 50.8243, 15.1469),
        "center": [15.057, 50.767],
    },
    {
        "id": "olomouc",
        "name": "Olomouc",
        "bbox": (49.5347, 17.1621, 49.6620, 17.3961),
        "center": [17.251, 49.593],
    },
    {
        "id": "ceske_budejovice",
        "name": "České Budějovice",
        "bbox": (48.9334, 14.3869, 49.0199, 14.5952),
        "center": [14.475, 48.975],
    },
    {
        "id": "hradec_kralove",
        "name": "Hradec Králové",
        "bbox": (50.1600, 15.7468, 50.2659, 15.9350),
        "center": [15.832, 50.209],
    },
]

# ── Layer definitions ─────────────────────────────────────────────────────────
LAYERS: list[dict] = [
    {"name": "schools",       "fetcher": lambda bbox: fetch_msmt_pois("schools", bbox)},
    {"name": "kindergartens", "fetcher": lambda bbox: fetch_msmt_pois("kindergartens", bbox)},
    {"name": "playgrounds",   "fetcher": lambda bbox: fetch_osm_pois("playgrounds", bbox)},
    {"name": "clinics",       "fetcher": lambda bbox: fetch_nrpzs_pois("clinics", bbox)},
    {"name": "pharmacies",    "fetcher": lambda bbox: fetch_nrpzs_pois("pharmacies", bbox)},
    {"name": "transport",     "fetcher": lambda bbox: fetch_gtfs_stops(bbox)},
    {"name": "parks",         "fetcher": lambda bbox: fetch_osm_pois("parks", bbox)},
    {"name": "sports",        "fetcher": lambda bbox: fetch_osm_pois("sports", bbox)},
    {"name": "shops",         "fetcher": lambda bbox: fetch_osm_pois("shops", bbox)},
    # zonal layers: fetcher returns polygons, scored by coverage instead of POI count
    {"name": "quiet",         "fetcher": fetch_noise_polygons, "kind": "zonal"},
    # inverted layers: density is bad — score flipped so 1.0 = safest
    {"name": "safety",        "fetcher": fetch_crime_points, "invert": True},
]


def backfill_missing_from_release(layer_names: list[str], tag: str = "data-latest") -> None:
    """Download last good PMTiles for layers that produced nothing this run.

    On a fresh CI checkout the local file is gone, so a skipped layer would
    vanish from the recreated release. Pull its previous asset first.
    """
    import requests as req
    repo = os.environ.get("GITHUB_REPOSITORY", "n07name7/czech-geo-portal")
    base = f"https://github.com/{repo}/releases/download/{tag}"
    for name in layer_names:
        dest = OUTPUT_DIR / f"{name}.pmtiles"
        try:
            r = req.get(f"{base}/{name}.pmtiles", timeout=600)
            if r.status_code == 200 and r.content:
                dest.write_bytes(r.content)
                print(f"  backfilled {name}.pmtiles from previous release "
                      f"({len(r.content)//1024} KB)")
            else:
                print(f"  no previous {name}.pmtiles to backfill (HTTP {r.status_code})")
        except req.RequestException as e:
            print(f"  backfill {name} failed: {e}")


def upload_to_github_release(files: list[Path], tag: str = "data-latest") -> None:
    import requests as req
    token = os.environ["GITHUB_TOKEN"]
    repo = os.environ.get("GITHUB_REPOSITORY", "n07name7/czech-geo-portal")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    api = "https://api.github.com"

    # Delete ALL releases carrying this tag, including drafts. The previous
    # code used GET /releases/tags/{tag}, which never returns drafts — so
    # draft releases piled up and the public download URL served a stale one.
    page = 1
    while True:
        r = req.get(f"{api}/repos/{repo}/releases",
                    headers=headers, params={"per_page": 100, "page": page})
        r.raise_for_status()
        releases = r.json()
        if not releases:
            break
        for rel in releases:
            if rel.get("tag_name") == tag:
                req.delete(f"{api}/repos/{repo}/releases/{rel['id']}", headers=headers)
        page += 1
    req.delete(f"{api}/repos/{repo}/git/refs/tags/{tag}", headers=headers)

    # target_commitish + draft=false → tag is created on master and the
    # release is published, so releases/download/{tag}/… resolves publicly.
    r = req.post(f"{api}/repos/{repo}/releases", headers=headers, json={
        "tag_name": tag,
        "target_commitish": "master",
        "name": "PMTiles data (auto-updated)",
        "draft": False,
        "prerelease": True,
    })
    r.raise_for_status()
    upload_url = r.json()["upload_url"].split("{")[0]

    for path in files:
        print(f"  uploading {path.name}...")
        with open(path, "rb") as f:
            r = req.post(
                f"{upload_url}?name={path.name}",
                headers={**headers, "Content-Type": "application/octet-stream"},
                data=f,
            )
            r.raise_for_status()
        print(f"  done -> github:{tag}/{path.name}")


def main(dry_run: bool = False, only_city: str | None = None) -> None:
    cities = CITIES if not only_city else [c for c in CITIES if c["id"] == only_city]
    if not cities:
        print(f"Unknown city: {only_city}. Valid: {[c['id'] for c in CITIES]}")
        sys.exit(1)

    print(f"Running ETL for: {[c['name'] for c in cities]}\n")

    failed_layers: list[str] = []
    # cell -> {layer_name: score} accumulated across layers for the combined file
    combined: dict[str, dict[str, float]] = {}
    for layer in LAYERS:
        layer_name = layer["name"]
        all_scores: dict[str, float] = {}

        for city in cities:
            print(f"[{layer_name}] {city['name']}: fetching...")
            try:
                fetched = layer["fetcher"](city["bbox"])
                print(f"  {len(fetched)} objects")
            except Exception as e:
                print(f"  ERROR: {e}")
                continue

            cells = get_city_cells(city["bbox"], RESOLUTION)
            if layer.get("kind") == "zonal":
                scores = score_cells_quiet(fetched, cells)
            else:
                scores = score_cells(fetched, cells)
                if layer.get("invert"):
                    scores = {c: 1.0 - v for c, v in scores.items()}
            all_scores.update(scores)
            print(f"  {len(cells)} cells scored")

        # A source outage must not wipe a layer: skip the build and keep
        # the previous release file rather than overwriting with nothing.
        if not all_scores:
            print(f"[{layer_name}] no data fetched — keeping previous file, SKIP\n")
            failed_layers.append(layer_name)
            continue

        for cell, score in all_scores.items():
            combined.setdefault(cell, {})[layer_name] = score

        out = OUTPUT_DIR / f"{layer_name}.pmtiles"
        print(f"[{layer_name}] building PMTiles ({len(all_scores)} cells) -> {out}")
        build_pmtiles(all_scores, out)
        print(f"  {out.stat().st_size // 1024} KB\n")

    # Combined dataset for the weighted "match" mode (every layer score per cell)
    if combined:
        out = OUTPUT_DIR / "combined.pmtiles"
        print(f"[combined] building PMTiles ({len(combined)} cells) -> {out}")
        build_combined_pmtiles(combined, out)
        print(f"  {out.stat().st_size // 1024} KB\n")

    if failed_layers:
        print(f"WARNING: layers with no data this run: {failed_layers}")
    print("All layers done.")

    if not dry_run:
        if failed_layers:
            print("\nBackfilling skipped layers from previous release...")
            backfill_missing_from_release(failed_layers)
        print("\nUploading to GitHub Releases...")
        files = [OUTPUT_DIR / f"{l['name']}.pmtiles" for l in LAYERS
                 if (OUTPUT_DIR / f"{l['name']}.pmtiles").exists()]
        upload_to_github_release(files)
        print("Upload complete.")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    only_city = next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--city"), None)
    main(dry_run=dry_run, only_city=only_city)
