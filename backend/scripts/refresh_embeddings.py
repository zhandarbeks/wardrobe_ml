import argparse
import json
import os
import sys
from pathlib import Path

import httpx

if "/app" not in sys.path:
    sys.path.insert(0, "/app")

from database import SessionLocal           # noqa: E402
from models import WardrobeItem             # noqa: E402

ML_URL     = os.getenv("ML_SERVICE_URL", "http://ml-service:8001")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR",  "/app/uploads"))


def _resolve_image_path(image_url: str) -> Path | None:
    """image_url is stored as e.g. '/uploads/abc.jpg'. We want the on-disk path."""
    if not image_url:
        return None
    fname = image_url.lstrip("/").split("/")[-1]
    p = UPLOAD_DIR / fname
    return p if p.exists() else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run",      action="store_true")
    parser.add_argument("--user-id",      type=int, default=None)
    parser.add_argument("--limit",        type=int, default=None)
    parser.add_argument("--only-missing", action="store_true",
                        help="skip items that already have a non-null embedding")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        q = db.query(WardrobeItem).filter(WardrobeItem.image_url.isnot(None))
        if args.user_id is not None:
            q = q.filter(WardrobeItem.user_id == args.user_id)
        if args.only_missing:
            q = q.filter(WardrobeItem.embedding.is_(None))
        items = q.all()
        if args.limit:
            items = items[:args.limit]

        print(f"ml-service:  {ML_URL}")
        print(f"upload dir:  {UPLOAD_DIR}")
        print(f"Items to process: {len(items)}")
        print(f"Mode:        {'DRY-RUN' if args.dry_run else 'WRITE'}")
        print("-" * 70)

        if not items:
            print("Nothing to do.")
            return

        if args.dry_run:
            for it in items[:30]:
                p = _resolve_image_path(it.image_url)
                ok = "✓" if p else "✗ missing"
                print(f"  id={str(it.id)[:8]}  {it.name[:30]:30s}  {ok}")
            if len(items) > 30:
                print(f"  ... and {len(items) - 30} more")
            return

        ok = 0; missing = 0; failed = 0
        with httpx.Client(timeout=60.0) as client:
            for it in items:
                p = _resolve_image_path(it.image_url)
                if p is None:
                    print(f"  ✗ id={str(it.id)[:8]}  no file for {it.image_url!r}")
                    missing += 1
                    continue
                try:
                    with open(p, "rb") as f:
                        resp = client.post(
                            f"{ML_URL}/analyze",
                            files={"file": (p.name, f, "image/jpeg")},
                        )
                except Exception as e:
                    print(f"  ✗ id={str(it.id)[:8]}  request failed: {e}")
                    failed += 1
                    continue
                if resp.status_code != 200:
                    print(f"  ✗ id={str(it.id)[:8]}  status {resp.status_code}: {resp.text[:80]}")
                    failed += 1
                    continue
                emb = resp.json().get("embedding") or []
                if not isinstance(emb, list) or len(emb) != 128:
                    print(f"  ✗ id={str(it.id)[:8]}  bad embedding: len={len(emb) if emb else 0}")
                    failed += 1
                    continue
                it.embedding = json.dumps(emb)
                ok += 1
                if ok % 10 == 0:
                    db.commit()
                    print(f"  ✓ {ok}/{len(items)}  (committed)")
        db.commit()
        print()
        print(f"Updated:  {ok}")
        print(f"Missing:  {missing}")
        print(f"Failed:   {failed}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
