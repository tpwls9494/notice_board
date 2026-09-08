#!/usr/bin/env bash
# Existing-installation release only. No down, volume deletion, or automatic rollback.
set -Eeuo pipefail
umask 077
source "$(dirname -- "${BASH_SOURCE[0]}")/scripts/release-common.sh"

if [[ "${1:-}" != --confirm-downtime || "$#" != 1 ]]; then
  echo "Usage: bash deploy.sh --confirm-downtime" >&2
  echo "Both sites will be unavailable during backup/migration/checks. Pause external writers first." >&2
  exit 2
fi
for executable in docker python3 flock sha256sum; do
  command -v "$executable" >/dev/null
done
if [[ "$compose_file" == docker-compose.prod.yml && ! -f .env ]]; then
  echo "Missing production .env. Do not copy local rehearsal credentials." >&2
  exit 1
fi
# Compose can exit 0 after silently substituting an unset variable with empty text.
# Do not echo raw diagnostics: invalid environment values may be sensitive.
if ! config_diagnostics="$("${compose[@]}" config --quiet 2>&1)"; then
  echo "Compose configuration is invalid. Review it locally without sharing environment values." >&2
  exit 1
fi
if grep -Eiq 'is not set|Defaulting to a blank string' <<< "$config_diagnostics"; then
  echo "Compose has unset variables. Explicitly configure every referenced key before deployment." >&2
  exit 1
fi
mkdir -p backups
exec 9>backups/.release.lock
flock -n 9 || { echo "Another release/backup owns the workspace lock." >&2; exit 1; }
export RELEASE_LOCK_HELD=1
require_single_containers
require_running postgres redis backend nginx

release_id="$(date -u +%Y%m%dT%H%M%SZ)-$$"
state_dir="$(mktemp -d "$release_root/backups/preparation-$release_id-XXXXXX")"
candidate="jion-release-check-$release_id"
candidate_created=0
maintenance=0
backup_dir="not-created"
finish() {
  result=$?
  trap - EXIT
  if (( candidate_created )); then
    docker stop "$candidate" >/dev/null 2>&1 || true
    docker rm "$candidate" >/dev/null 2>&1 || true
  fi
  if (( result != 0 )); then
    if (( maintenance )); then
      if "${compose[@]}" stop nginx backend >/dev/null 2>&1; then
        echo "Release failed; public services remain stopped. Do NOT restart blindly after migration." >&2
      else
        echo "CRITICAL: cannot confirm public services stopped. Manually isolate ingress and inspect Docker." >&2
      fi
    fi
    echo "Release evidence: $state_dir; backup: $backup_dir" >&2
  fi
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

python3 scripts/release-manifest.py > "$state_dir/source-before.json"
"${compose[@]}" config --format json | python3 scripts/check-release-compose.py > "$state_dir/config-before.json"
# Pin the old manifest BEFORE mutable Compose build tags move. Some containerd
# image stores otherwise cannot resolve the old container's .Image after a build.
for service in backend nginx; do
  container_id="$("${compose[@]}" ps -q "$service")"
  old_image="$(docker inspect --format '{{.Image}}' "$container_id")"
  rollback_ref="jion-rollback-${release_id,,}-$service:retained"
  docker tag "$old_image" "$rollback_ref"
  printf '%s\n' "$rollback_ref" > "$state_dir/$service.rollback-image.txt"
done
export RELEASE_BACKUP_BACKEND_IMAGE="$(< "$state_dir/backend.rollback-image.txt")"
export RELEASE_BACKUP_NGINX_IMAGE="$(< "$state_dir/nginx.rollback-image.txt")"
if [[ -n "${RELEASE_PREBUILT_BUNDLE:-}" ]]; then
  echo "Verifying immutable prebuilt images; no server build or image pull..."
  "${compose[@]}" config --format json | python3 scripts/check-release-prebuilt.py \
    "$RELEASE_PREBUILT_BUNDLE" "$state_dir/source-before.json" > "$state_dir/prebuilt-before.json"
else
  echo "Building both frontends and backend while existing services remain available..."
  "${compose[@]}" build --progress=plain backend nginx
fi
python3 scripts/release-manifest.py > "$state_dir/source-after.json"
cmp "$state_dir/source-before.json" "$state_dir/source-after.json" || {
  echo "Source changed during build. Reconcile both sessions and retry before maintenance." >&2
  exit 1
}
"${compose[@]}" config --format json | python3 scripts/check-release-compose.py > "$state_dir/config-after.json"
cmp "$state_dir/config-before.json" "$state_dir/config-after.json" || {
  echo "Resolved environment/Compose configuration changed during build. Retry before downtime." >&2
  exit 1
}
if [[ -n "${RELEASE_PREBUILT_BUNDLE:-}" ]]; then
  "${compose[@]}" config --format json | python3 scripts/check-release-prebuilt.py \
    "$RELEASE_PREBUILT_BUNDLE" "$state_dir/source-after.json" > "$state_dir/prebuilt-after.json"
  cmp "$state_dir/prebuilt-before.json" "$state_dir/prebuilt-after.json"
fi
# Override ENTRYPOINT and CMD: no migration or app startup is allowed here.
"${compose[@]}" run --rm --no-deps -T --entrypoint python backend - \
  < scripts/check-release-settings.py > "$state_dir/settings-check.json"
require_single_containers

echo "Entering downtime: stopping public ingress, then draining backend requests..."
maintenance=1
"${compose[@]}" stop -t 60 nginx backend
require_stopped_apps
bash scripts/backup-release.sh > "$state_dir/backup-path.txt"
backup_dir="$(< "$state_dir/backup-path.txt")"
test -f "$backup_dir/SHA256SUMS"
cp "$state_dir/source-before.json" "$backup_dir/candidate-source.json"

echo "Applying migrations to the actual database (not a test copy)..."
"${compose[@]}" run --rm --no-deps -T backend alembic upgrade head
"${compose[@]}" up -d --no-deps backend
# No published ports: this Nginx also fills the shared blog HTML template volume.
"${compose[@]}" run -d --no-deps --name "$candidate" nginx > "$state_dir/candidate-id.txt"
candidate_created=1
test "$(docker inspect --format '{{len .HostConfig.PortBindings}}' "$candidate")" = 0

verify_release() {
  local target="$1" attempt
  for attempt in {1..12}; do
    if "${compose[@]}" exec -T backend python - --connect-host "$target" \
      < scripts/check-release.py > "$state_dir/check-$target.json" 2> "$state_dir/check-$target.error"; then
      return 0
    fi
    sleep 3
  done
  cat "$state_dir/check-$target.error" >&2
  return 1
}
verify_release "$candidate"
docker stop "$candidate" >/dev/null
docker rm "$candidate" >/dev/null
candidate_created=0

echo "Private candidate passed. Reopening both sites..."
"${compose[@]}" up -d --no-deps nginx
verify_release nginx
maintenance=0
echo "Release passed. Backup: $backup_dir; evidence: $state_dir"
echo "Complete external-domain and real-account checks before resuming scheduled writers."
"${compose[@]}" ps
