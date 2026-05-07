"""
ETL orchestrator. Run:
    python main.py [--dry-run]
Fetches all layers for Prague, scores H3 cells, builds PMTiles.
With --dry-run: skips R2 upload (for local testing).
"""
import os
import sys
from pathlib import Path

from src.fetch.osm import fetch_osm_pois
from src.fetch.msmt import fetch_msmt_pois
from src.fetch.nrpzs import fetch_nrpzs_pois
from src.fetch.gtfs import fetch_gtfs_stops
from src.score.h3_scorer import get_prague_cells, score_cells
from src.build.pmtiles import build_pmtiles

OUTPUT_DIR = Path("output/prague")
RESOLUTION = 10

LAYERS: list[dict] = [
    {"name": "schools",        "fetcher": lambda: fetch_msmt_pois("schools")},
    {"name": "kindergartens",  "fetcher": lambda: fetch_msmt_pois("kindergartens")},
    {"name": "playgrounds",    "fetcher": lambda: fetch_osm_pois("playgrounds")},
    {"name": "clinics",        "fetcher": lambda: fetch_nrpzs_pois("clinics")},
    {"name": "pharmacies",     "fetcher": lambda: fetch_nrpzs_pois("pharmacies")},
    {"name": "transport",      "fetcher": fetch_gtfs_stops},
    {"name": "parks",          "fetcher": lambda: fetch_osm_pois("parks")},
    {"name": "sports",         "fetcher": lambda: fetch_osm_pois("sports")},
    {"name": "shops",          "fetcher": lambda: fetch_osm_pois("shops")},
]


def upload_to_github_release(files: list[Path], tag: str = "data-latest") -> None:
    import requests as req
    token = os.environ["GITHUB_TOKEN"]
    repo = os.environ.get("GITHUB_REPOSITORY", "n07name7/czech-geo-portal")
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    api = "https://api.github.com"

    r = req.get(f"{api}/repos/{repo}/releases/tags/{tag}", headers=headers)
    if r.status_code == 200:
        release_id = r.json()["id"]
        req.delete(f"{api}/repos/{repo}/releases/{release_id}", headers=headers)
    req.delete(f"{api}/repos/{repo}/git/refs/tags/{tag}", headers=headers)

    r = req.post(f"{api}/repos/{repo}/releases", headers=headers, json={
        "tag_name": tag, "name": "PMTiles data (auto-updated)", "prerelease": True,
    })
    r.raise_for_status()
    upload_url = r.json()["upload_url"].split("{")[0]

    for path in files:
        print(f"  uploading {path.name}...")
        with open(path, "rb") as f:
            r = req.post(f"{upload_url}?name={path.name}", headers={**headers, "Content-Type": "application/octet-stream"}, data=f)
            r.raise_for_status()
        print(f"  uploaded -> github:{tag}/{path.name}")


def main(dry_run: bool = False) -> None:
    print("Fetching Prague H3 cells...")
    cells = get_prague_cells(RESOLUTION)
    print(f"  {len(cells)} cells at resolution {RESOLUTION}")

    for layer in LAYERS:
        name = layer["name"]
        print(f"\n[{name}] fetching POIs...")
        try:
            pois = layer["fetcher"]()
            print(f"  {len(pois)} POIs found")
        except Exception as e:
            print(f"  ERROR fetching {name}: {e}")
            continue

        print(f"[{name}] scoring cells...")
        scores = score_cells(pois, cells)

        out = OUTPUT_DIR / f"{name}.pmtiles"
        print(f"[{name}] building PMTiles -> {out}")
        build_pmtiles(scores, out)
        print(f"  {out} ({out.stat().st_size // 1024}KB)")

    print("\nAll layers done.")
    if not dry_run:
        print("\nUploading to GitHub Releases...")
        files = [OUTPUT_DIR / f"{layer['name']}.pmtiles" for layer in LAYERS if (OUTPUT_DIR / f"{layer['name']}.pmtiles").exists()]
        upload_to_github_release(files)


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    main(dry_run=dry_run)
