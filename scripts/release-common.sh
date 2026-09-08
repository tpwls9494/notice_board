#!/usr/bin/env bash
# Shared configuration; override only for an explicitly isolated rehearsal.
release_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$release_root"
compose_file="${RELEASE_COMPOSE_FILE:-docker-compose.prod.yml}"
compose=(docker compose -f "$compose_file")
if [[ -n "${RELEASE_PROJECT_NAME:-}" ]]; then
  compose+=(-p "$RELEASE_PROJECT_NAME")
fi

require_single_containers() {
  local service ids project leftovers
  for service in postgres redis backend nginx; do
    ids="$("${compose[@]}" ps -a -q "$service")"
    if [[ -z "$ids" || "$ids" == *$'\n'* ]]; then
      echo "Expected exactly one $service container; inspect this project's stopped/one-off containers before deployment." >&2
      return 1
    fi
  done
  project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$ids")"
  [[ -n "$project" && "$project" != '<no value>' ]] || return 1
  leftovers="$(docker ps -a -q --filter "label=com.docker.compose.project=$project" --filter 'label=com.docker.compose.oneoff=True')"
  if [[ -n "$leftovers" ]]; then
    echo "One-off containers remain in project $project. Review them manually; no automatic deletion was performed." >&2
    return 1
  fi
}

require_running() {
  local service
  for service in "$@"; do
    if ! "${compose[@]}" ps --status running --services | grep -qx "$service"; then
      echo "Required running service missing: $service" >&2
      return 1
    fi
  done
}

require_stopped_apps() {
  local service container_id
  for service in backend nginx; do
    container_id="$("${compose[@]}" ps -a -q "$service")"
    if [[ -z "$container_id" || "$container_id" == *$'\n'* ]] || [[ "$(docker inspect --format '{{.State.Status}}' "$container_id")" != exited ]]; then
      echo "Backup requires an existing, stopped $service container. Stop both public services first." >&2
      return 1
    fi
  done
}
