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


def upload_to_r2(local_path: Path, r2_key: str) -> None:
    import boto3
    from botocore.config import Config
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
    )
    bucket = os.environ["R2_BUCKET_NAME"]
    s3.upload_file(
        str(local_path),
        bucket,
        r2_key,
        ExtraArgs={"ContentType": "application/octet-stream"},
    )
    print(f"  uploaded -> r2://{bucket}/{r2_key}")


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

        if not dry_run:
            print(f"[{name}] uploading to R2...")
            upload_to_r2(out, f"prague/{name}.pmtiles")

    print("\nAll layers done.")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    main(dry_run=dry_run)
