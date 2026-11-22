#!/usr/bin/env python3
"""Check the final AAB's compiled manifest for Play's restricted media permissions."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    args = parser.parse_args()
    restricted = (
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
    )
    required = ("com.footnation.app", "android.permission.INTERNET")
    with zipfile.ZipFile(args.bundle) as archive:
        manifest = archive.read("base/manifest/AndroidManifest.xml")
    if not manifest or len(manifest) > 2_000_000:
        raise SystemExit("Invalid or unexpectedly large AAB manifest")
    missing = [item for item in required if item.encode() not in manifest]
    present = [item for item in restricted if item.encode() in manifest]
    if missing or present:
        raise SystemExit(f"Manifest check failed: missing={missing}, restricted={present}")
    digest = hashlib.file_digest(args.bundle.open("rb"), "sha256").hexdigest()
    print(json.dumps({"bundle": str(args.bundle), "sha256": digest,
                      "required_strings_present": required,
                      "restricted_permissions_found": present}, ensure_ascii=False))


if __name__ == "__main__":
    main()
