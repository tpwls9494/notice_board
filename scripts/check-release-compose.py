"""Read resolved Compose JSON from stdin; output a hash and non-secret build facts.

Never save/print the resolved configuration: it contains environment secrets.
"""
import hashlib
import json
import sys
from urllib.parse import urlsplit


def summary(config):
    services = config.get("services", {})
    api_origin = services.get("nginx", {}).get("build", {}).get("args", {}).get("VITE_API_URL") or ""
    if api_origin:
        url = urlsplit(api_origin)
        if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment or url.path:
            raise ValueError("VITE_API_URL must be empty or an HTTPS origin without credentials, path, query or fragment")
    return {"configuration_sha256": hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest(),
            "vite_api_origin": api_origin,
            "api_mode": "browser-origin" if not api_origin else "configured-origin",
            "restart_policies": {name: service.get("restart", "no") for name, service in services.items()}}


if __name__ == "__main__":
    try:
        result = summary(json.load(sys.stdin))
    except Exception as exc:
        # Do not echo a parse exception or input that could contain credentials.
        print("Invalid Compose/build configuration: " + type(exc).__name__, file=sys.stderr)
        raise SystemExit(1)
    print(json.dumps(result, indent=2, sort_keys=True))
