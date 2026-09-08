"""Hash deployable source (including untracked files), never runtime data/secrets."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = ("backend", "frontend", "frontend-blog", "nginx", "scripts", "config")
FILES = ("Dockerfile.nginx", "docker-compose.prod.yml", "deploy.sh", ".dockerignore", ".gitattributes")
EXCLUDED = {"node_modules", "dist", "build", "uploads", "__pycache__", ".pytest_cache", ".venv", "venv", ".git"}


def eligible(path):
    return (not EXCLUDED.intersection(path.parts)
            and not (path.name.startswith(".env") and path.name != ".env.example")
            and path.suffix.lower() not in {".db", ".sqlite", ".sqlite3", ".pyc", ".log", ".pem", ".key"})


def manifest():
    paths = [ROOT / name for name in FILES]
    for directory in DIRECTORIES:
        for current, directories, files in os.walk(ROOT / directory):
            directories[:] = [name for name in directories if name not in EXCLUDED]
            for name in directories:
                if (Path(current) / name).is_symlink():
                    raise ValueError("Release source symlink requires review")
            paths.extend(Path(current) / name for name in files)
    rows = {}
    for path in sorted(paths):
        relative = path.relative_to(ROOT)
        if not eligible(relative):
            continue
        if path.is_symlink():
            raise ValueError(f"Release source symlink requires review: {relative}")
        if path.is_file():
            rows[relative.as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return rows


if __name__ == "__main__":
    print(json.dumps(manifest(), indent=2, sort_keys=True))
