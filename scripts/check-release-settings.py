"""Validate new-image settings without DB connections, app startup or secret output."""
import json
import sys

sys.path.insert(0, "/app")


def main():
    from pydantic import ValidationError
    try:
        from app.core.config import settings
        required = ("DATABASE_URL", "REDIS_URL", "SECRET_KEY", "ALGORITHM")
        empty = [name for name in required if not getattr(settings, name, "").strip()]
        if empty:
            print(json.dumps({"valid": False, "empty_fields": empty}), file=sys.stderr)
            return 1
    except ValidationError as exc:
        errors = [{"field": ".".join(map(str, error["loc"])), "type": error["type"]} for error in exc.errors()]
        print(json.dumps({"valid": False, "errors": errors}), file=sys.stderr)
        return 1
    except Exception as exc:
        print(json.dumps({"valid": False, "error_type": type(exc).__name__}), file=sys.stderr)
        return 1
    print(json.dumps({"valid": True, "database_connection_attempted": False}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
