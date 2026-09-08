"""Validate locally loaded, immutable release images against a frozen source manifest.

Resolved Compose JSON arrives on stdin; never persist or print its secrets.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import sys


def validate(bundle, source, config, inspect):
    if bundle.get("source") != source:
        raise ValueError("Prebuilt source manifest differs from this checkout")
    images = bundle.get("images", {})
    if set(images) != {"backend", "nginx"}:
        raise ValueError("Prebuilt bundle must select backend and nginx")
    for service, image_id in images.items():
        if not isinstance(image_id, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", image_id):
            raise ValueError("Prebuilt images require immutable sha256 IDs")
        service_config = config.get("services", {}).get(service, {})
        if service_config.get("image") != image_id:
            raise ValueError("Compose image does not match the prebuilt bundle")
        metadata = inspect(image_id)
        if metadata.get("Id") != image_id or metadata.get("Os") != "linux" or metadata.get("Architecture") != "amd64":
            raise ValueError("Prebuilt image ID or platform differs")
    return {"verified": True, "images": images, "source_files": len(source)}


def inspect_image(image_id):
    result = subprocess.run(["docker", "image", "inspect", image_id], capture_output=True, text=True)
    if result.returncode:
        raise ValueError("Prebuilt image is not loaded; no automatic pull/build allowed")
    return json.loads(result.stdout)[0]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle")
    parser.add_argument("source")
    args = parser.parse_args()
    try:
        result = validate(json.loads(Path(args.bundle).read_text()),
                          json.loads(Path(args.source).read_text()), json.load(sys.stdin), inspect_image)
    except Exception as exc:
        # Invalid config/input can contain secrets; do not echo it or a traceback.
        print("Prebuilt release verification failed: " + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
    print(json.dumps(result, sort_keys=True))
