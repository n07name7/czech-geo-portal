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

from src.fetch.osm import fetch_osm_pois
from src.fetch.msmt import fetch_msmt_pois
from src.fetch.nrpzs import fetch_nrpzs_pois
from src.fetch.gtfs import fetch_gtfs_stops
from src.score.h3_scorer import get_city_cells, score_cells
from src.build.pmtiles import build_pmtiles

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
]


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

    r = req.get(f"{api}/repos/{repo}/releases/tags/{tag}", headers=headers)
    if r.status_code == 200:
        release_id = r.json()["id"]
        req.delete(f"{api}/repos/{repo}/releases/{release_id}", headers=headers)
    req.delete(f"{api}/repos/{repo}/git/refs/tags/{tag}", headers=headers)

    r = req.post(f"{api}/repos/{repo}/releases", headers=headers, json={
        "tag_name": tag,
        "name": "PMTiles data (auto-updated)",
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

    for layer in LAYERS:
        layer_name = layer["name"]
        all_scores: dict[str, float] = {}

        for city in cities:
            print(f"[{layer_name}] {city['name']}: fetching POIs...")
            try:
                pois = layer["fetcher"](city["bbox"])
                print(f"  {len(pois)} POIs")
            except Exception as e:
                print(f"  ERROR: {e}")
                continue

            cells = get_city_cells(city["bbox"], RESOLUTION)
            scores = score_cells(pois, cells)
            all_scores.update(scores)
            print(f"  {len(cells)} cells scored")

        out = OUTPUT_DIR / f"{layer_name}.pmtiles"
        print(f"[{layer_name}] building PMTiles ({len(all_scores)} cells) -> {out}")
        build_pmtiles(all_scores, out)
        print(f"  {out.stat().st_size // 1024} KB\n")

    print("All layers done.")

    if not dry_run:
        print("\nUploading to GitHub Releases...")
        files = [OUTPUT_DIR / f"{l['name']}.pmtiles" for l in LAYERS
                 if (OUTPUT_DIR / f"{l['name']}.pmtiles").exists()]
        upload_to_github_release(files)
        print("Upload complete.")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    only_city = next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--city"), None)
    main(dry_run=dry_run, only_city=only_city)
