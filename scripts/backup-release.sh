#!/usr/bin/env bash
# Existing installation only: callers must stop ingress and all application writers.
set -Eeuo pipefail
umask 077
source "$(dirname -- "${BASH_SOURCE[0]}")/release-common.sh"
mkdir -p backups
if [[ "${RELEASE_LOCK_HELD:-}" != 1 ]]; then
  exec 9>backups/.release.lock
fi
flock -n 9 || { echo "Another release/backup owns the workspace lock, or the inherited lock is missing." >&2; exit 1; }
require_running postgres redis
require_stopped_apps
backend_id="$("${compose[@]}" ps -a -q backend)"
backend_image="${RELEASE_BACKUP_BACKEND_IMAGE:-$(docker inspect --format '{{.Image}}' "$backend_id")}"
backup_dir="$(mktemp -d "$release_root/backups/release-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")"
trap 'echo "Backup incomplete; do not deploy. Check: $backup_dir" >&2' ERR
"${compose[@]}" exec -T postgres sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$backup_dir/database.dump"
test -s "$backup_dir/database.dump"
"${compose[@]}" exec -T postgres pg_restore --list < "$backup_dir/database.dump" > "$backup_dir/database.contents.txt"
# Reuse the OLD image and stopped container's mounts, read-only, without app startup.
docker run --rm --network none --volumes-from "$backend_id:ro" --entrypoint tar \
  "$backend_image" -C /app -czf - uploads > "$backup_dir/uploads.tar.gz"
test -s "$backup_dir/uploads.tar.gz"
tar -tzf "$backup_dir/uploads.tar.gz" > "$backup_dir/uploads.contents.txt"
cp "$compose_file" "$backup_dir/compose-source.yml"
for service in backend nginx; do
  container_id="$("${compose[@]}" ps -a -q "$service")"
  docker inspect --format '{{.Image}}' "$container_id" > "$backup_dir/$service.image-id"
  # Mount metadata only; never dump container environment secrets.
  docker inspect --format '{{json .Mounts}}' "$container_id" > "$backup_dir/$service.mounts.json"
done
printf '%s\n' "$backend_image" > "$backup_dir/backend.rollback-image.txt"
printf '%s\n' "${RELEASE_BACKUP_NGINX_IMAGE:-$(< "$backup_dir/nginx.image-id")}" > "$backup_dir/nginx.rollback-image.txt"
"${compose[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT version_num FROM alembic_version"' > "$backup_dir/database-revision.txt"
git rev-parse HEAD > "$backup_dir/working-tree-head.txt" 2>/dev/null || printf '%s\n' 'unversioned deployment' > "$backup_dir/working-tree-head.txt"
(cd "$backup_dir" && sha256sum database.dump uploads.tar.gz > SHA256SUMS && sha256sum --check SHA256SUMS >&2)
trap - ERR
echo "Verified backup: $backup_dir" >&2
# stdout is a single exact path, consumed by deploy.sh.
printf '%s\n' "$backup_dir"
