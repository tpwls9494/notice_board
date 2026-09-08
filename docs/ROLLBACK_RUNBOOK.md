# 통합 배포 롤백 실행 절차

2026-09-06. **운영 실행 승인이 아닌 준비용 절차**다. 운영 서버·이전 환경/Compose·백업·프로젝트 이름을 확인하고 점검 시간을 승인받은 후 사용한다. DB를 덮어쓰거나 `down -v`/이미지 정리를 하지 않는다.

## 런북 원문 실행 검증 — 추가 완료

격리 프로젝트 `jion-runbook-20260906104420`에서 **이 문서의 Bash 블록 4개와 YAML 블록 1개를 직접 추출해 그대로 실행**했다. 명령을 다른 독립 Compose 절차로 바꿔 실행한 것이 아니다. Bash/YAML 각각의 SHA-256도 기록해 현재 문서와 비교할 수 있다.

- `--project-directory` / `--env-file` / `-f 이전 Compose -f override` 조합으로 실행했다. 이전 Compose 파일과 이전 소스 디렉터리도 서로 다른 위치에 두었다.
- 이전 소스에는 `scripts/`가 아예 없는 상태로 실행했다. `checker_root=/workspace`의 현재 검사 스크립트 절대 경로를 사용해 설정/페이지 검사까지 통과했다.
- 기존 서비스 4개에 격리된 고정 `container_name`을 지정했다. 명시한 `--name`으로 후보를 실행할 때 이름 충돌이 없었고, 기존 고정 이름도 유지됐다.
- 후보 검사 직전에 실제 컨테이너를 조회해 `public_nginx_running=false`, `candidate_host_ports=0`을 확인했다. 명령 로그에서 후보 검사 이후에만 공개 Nginx가 시작됨을 확인했다.
- 병합 후 image·command·DATABASE_URL·마운트 경로별 볼륨 대체를 확인했다. 누락된 이전 build 디렉터리를 사용하지 않고 이전 이미지로 실행됐다.
- 이전 이미지 HTML 제공, 블로그 템플릿, 별도 복원 DB와 업로드 내용 해시 일치를 확인했다. 실패 표식 DB·파일은 원래 DB/볼륨에 보존했다.
- 검사 후 이 프로젝트의 컨테이너만 중지했다. 데이터·백업·이미지를 삭제하지 않았다.

증거 요약: `.local-preview/integrated-release/runbook-verbatim.json`.
상세 증거 디렉터리: `.local-preview/integrated-release/jion-runbook-20260906104420/`.
그 안의 `runbook-extracted.sh`, `rollback.override.yml`, `code-block-hashes.json`, `runbook-commands.jsonl`, `runbook.stdout`, `runbook.stderr`, `checks/check-*.json`을 원문과 대조할 수 있다.
검증기: `.local-preview/integrated-release/rehearse-runbook.py` (Linux Docker 실행기용, 로컬 고정 테스트 백업만 사용).

이 검증은 로컬 원문 명령 실행을 입증한다. 실제 운영 환경의 변수·권한·인증서·데이터 규모와 운영 승인까지 대신하지 않는다. 아래의 DB 샘플/업무 데이터 확인 등 사람의 판단 단계는 운영 데이터에 대해 별도로 수행한다.

## 이전 독립 구성 검증 기록

격리 프로젝트 `jion-rollback-review-20260906100819`에서 다음을 실행했다.

1. 통합 백업 `release-20260906T100501Z-lx39PV`의 DB·업로드를 새 테스트 프로젝트에 복원하고 새 이미지로 기동.
2. DB에 실패 표식 테이블을 만들고 기존 글 제목을 변경, 업로드에도 실패 표식 추가.
3. Nginx·백엔드 중단. 같은 PostgreSQL 안의 **두 번째 DB**와 **새 업로드 볼륨**으로 백업을 복원.
4. 복구 태그의 이전 백엔드·Nginx 이미지와 복원 DB/볼륨으로 교체. 새 템플릿 볼륨에 이전 블로그 HTML 재복사.
5. 양쪽 HTTPS 페이지/정적 파일/SEO/DB 검사 및 복원 전후 체크섬 일치 확인.

이전/신규 본사이트 HTML 해시가 서로 달랐고, 롤백 후 제공 파일은 이전 이미지의 해시와 일치했다. 즉 같은 이미지를 재시작한 검증이 아니다. 실패 표식이 있는 원본 DB·볼륨은 삭제하지 않았다. 검증 후 이 롤백 프로젝트의 컨테이너는 중지했고 데이터·이미지는 보존했다.

실행 명령 원본: `.local-preview/integrated-release/rollback-commands.json`.
결과: `.local-preview/integrated-release/rollback.json`.
실행기: `.local-preview/integrated-release/rehearse-rollback.py`.

운영의 서로 다른 스키마 버전·데이터 규모에 대한 복원 시간, 실제 트래픽 전환, OAuth·SMTP는 이 검증에 포함되지 않는다. 운영에서는 선택한 **이전 이미지의 Alembic head와 복원 DB revision이 맞는지** 별도로 확인한다.

## 운영 실행 전 선택할 값

승인된 셸 세션에서 아래 값을 실제 경로/이름으로 설정한다. 비밀번호를 입력하거나 화면에 출력하는 예제가 아니다.

- `release_project`: 현재 운영 Compose 프로젝트 이름.
- `previous_compose`: 배포 전에 보관한 이전 운영 Compose 파일의 **절대 경로**. 위치를 옮겼다면 상대 bind/build 경로도 이전 운영 루트 기준으로 해석되도록 `--project-directory`를 지정한다.
- `previous_project_root`: 이전 Compose의 상대 경로 기준인 서버 프로젝트 절대 경로.
- `previous_env`: 서버에서 보호 중인 이전 환경 파일 절대 경로.
- `rollback_backup`: 선택한 `backups/release-*` 절대 경로.
- `restored_database`: 아직 존재하지 않는 새 DB 이름. 예: `jion_restore_20260906_01`.
- `restored_uploads`, `restored_template`: 아직 존재하지 않는 새 볼륨 이름.
- `rollback_override`: 아래 YAML을 작성할 보호된 절대 경로.
- `checker_root`: **현재 검증된 검사 스크립트 체크아웃의 절대 경로**. `previous_project_root`와 별개이며, 이전 소스 폴더에 새 검사 스크립트가 있다고 가정하지 않는다. 롤백 도중 이 체크아웃을 변경하지 않는다.
- `rollback_evidence`: 검사 JSON과 검사 스크립트 해시를 저장할 새 디렉터리 절대 경로. 부모 디렉터리는 미리 준비하고, 기존 증거 디렉터리를 재사용하지 않는다.

기존 환경 파일이 현재 셸 변수에 의해 덮어써지지 않게 주의한다. 특히 `DATABASE_URL`, `COMPOSE_PROJECT_NAME`, 빌드 인자가 포함된 셸 환경을 먼저 검토한다. 민감한 `docker compose config` 전체 출력은 공유하지 않는다.

## 1. 대상 확인·검증·중단

아래 명령은 Linux Bash 기준이다. 필요한 값이 없으면 즉시 중단한다.

```bash
set -Eeuo pipefail
umask 077
: "${release_project:?}" "${previous_compose:?}" "${previous_project_root:?}"
: "${previous_env:?}" "${rollback_backup:?}" "${restored_database:?}"
: "${restored_uploads:?}" "${restored_template:?}" "${rollback_override:?}"
: "${checker_root:?}" "${rollback_evidence:?}"
[[ "$previous_compose" = /* && "$previous_project_root" = /* && "$previous_env" = /* && "$rollback_backup" = /* && "$rollback_override" = /* ]]
[[ "$checker_root" = /* && "$rollback_evidence" = /* ]]
test -f "$checker_root/scripts/check-release-settings.py"
test -f "$checker_root/scripts/check-release.py"
mkdir -m 700 "$rollback_evidence"
sha256sum "$checker_root/scripts/check-release-settings.py" "$checker_root/scripts/check-release.py" > "$rollback_evidence/checker-SHA256SUMS"
[[ "$restored_database" =~ ^jion_restore_[a-z0-9_]+$ ]]
[[ "$restored_uploads" =~ ^jion-restore-[a-z0-9-]+$ && "$restored_template" =~ ^jion-restore-[a-z0-9-]+$ ]]
test "$restored_uploads" != "$restored_template"
cd "$previous_project_root"
prior=(docker compose --project-directory "$previous_project_root" --env-file "$previous_env" -p "$release_project" -f "$previous_compose")
"${prior[@]}" ps -a
(cd "$rollback_backup" && sha256sum --check SHA256SUMS)
export ROLLBACK_BACKEND_IMAGE="$(< "$rollback_backup/backend.rollback-image.txt")"
export ROLLBACK_NGINX_IMAGE="$(< "$rollback_backup/nginx.rollback-image.txt")"
docker image inspect --format '{{.Id}}' "$ROLLBACK_BACKEND_IMAGE" "$ROLLBACK_NGINX_IMAGE"
"${prior[@]}" stop -t 60 nginx backend
```

이전 이미지가 없으면 중단하고 사전에 저장한 이미지/레지스트리에서 복구한다. 새로운 소스를 빌드해 대체하지 않는다. 외부 수집/직접 DB 쓰기도 이미 중단되어 있어야 한다.

## 2. 별도 DB 복원

기존 DB를 삭제하거나 덮어쓰지 않는다. 새 DB 이름이 이미 있으면 `createdb`가 실패하므로 다른 이름을 검토한다.

```bash
"${prior[@]}" exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$restored_database"
"${prior[@]}" exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" --exit-on-error --dbname "$1"' sh "$restored_database" < "$rollback_backup/database.dump"
"${prior[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$1" -Atc "SELECT version_num FROM alembic_version"' sh "$restored_database"
```

이후 복원 DB의 주요 데이터 개수·샘플·스키마를 백업 시점과 비교한다. 검증되지 않은 DB로 전환하지 않는다.

## 3. 새 업로드·템플릿 볼륨 준비

아카이브가 `uploads/` 아래의 일반 파일/디렉터리만 포함하는지 검사한다. 링크·장치·경로 이동 항목은 자동 복원하지 않는다.

```bash
python3 - "$rollback_backup/uploads.tar.gz" <<'PY'
import sys, tarfile
from pathlib import PurePosixPath
with tarfile.open(sys.argv[1]) as archive:
    for member in archive:
        path = PurePosixPath(member.name)
        if path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0] != 'uploads' or not (member.isfile() or member.isdir()):
            raise SystemExit('Archive requires manual review; nothing extracted')
print('Archive paths and member types validated')
PY
for volume in "$restored_uploads" "$restored_template"; do
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    echo 'Restore volume already exists; choose a new name and review it.' >&2
    exit 1
  fi
  docker volume create "$volume"
done
docker run --rm -i --network none -v "$restored_uploads:/restore" --entrypoint tar \
  "$ROLLBACK_BACKEND_IMAGE" -xzf - -C /restore --strip-components=1 < "$rollback_backup/uploads.tar.gz"
export RESTORED_UPLOADS_VOLUME="$restored_uploads"
export RESTORED_TEMPLATE_VOLUME="$restored_template"
```

새 볼륨의 파일 개수·내용 해시를 백업과 비교한다. 실패 상태의 원래 업로드 볼륨은 보존한다.

## 4. 이전 이미지 + 복원 DB로 선택적 전환

`rollback_override` 경로에 다음 YAML을 작성한다. 복원 DB를 가리키는 `ROLLBACK_DATABASE_URL`은 **서버의 보호된 환경 설정**으로 준비하며, 채팅/명령 로그에 비밀번호가 포함된 URL을 출력하지 않는다.

```yaml
services:
  backend:
    image: ${ROLLBACK_BACKEND_IMAGE:?required}
    # 이미지 CMD의 자동 마이그레이션을 실행하지 않는다.
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    environment:
      DATABASE_URL: ${ROLLBACK_DATABASE_URL:?required}
    volumes:
      - rollback_uploads:/app/uploads
      - rollback_template:/app/blog-template:ro
  nginx:
    image: ${ROLLBACK_NGINX_IMAGE:?required}
    volumes:
      - rollback_template:/var/run/blog-template
volumes:
  rollback_uploads:
    external: true
    name: ${RESTORED_UPLOADS_VOLUME:?required}
  rollback_template:
    external: true
    name: ${RESTORED_TEMPLATE_VOLUME:?required}
```

```bash
rollback=("${prior[@]}" -f "$rollback_override")
"${rollback[@]}" config --quiet
"${rollback[@]}" run --rm --no-deps -T --entrypoint python backend - < "$checker_root/scripts/check-release-settings.py"
"${rollback[@]}" up -d --no-deps --no-build --force-recreate backend
# 먼저 호스트 포트를 공개하지 않는 후보로 검사한다.
rollback_candidate="jion-rollback-check-$(date -u +%Y%m%d%H%M%S)-$$"
"${rollback[@]}" run -d --no-deps --name "$rollback_candidate" nginx
test "$(docker inspect --format '{{len .HostConfig.PortBindings}}' "$rollback_candidate")" = 0
# 시작 직후의 준비 대기를 포함한다. 성공 확인 전에는 공개 nginx를 시작하지 않는다.
verify_rollback_target() {
  local target="$1" attempt
  for attempt in {1..12}; do
    if "${rollback[@]}" exec -T backend python - --connect-host "$target" \
      < "$checker_root/scripts/check-release.py" \
      > "$rollback_evidence/check-$target.json" 2> "$rollback_evidence/check-$target.error"; then
      return 0
    fi
    sleep 3
  done
  cat "$rollback_evidence/check-$target.error" >&2
  return 1
}
if ! verify_rollback_target "$rollback_candidate"; then
  docker stop "$rollback_candidate"
  docker rm "$rollback_candidate"
  "${rollback[@]}" stop backend
  exit 1
fi
docker stop "$rollback_candidate"
docker rm "$rollback_candidate"
"${rollback[@]}" up -d --no-deps --no-build --force-recreate nginx
if ! verify_rollback_target nginx; then
  "${rollback[@]}" stop nginx backend
  exit 1
fi
```

이전 이미지가 현재 검사 스크립트의 엔드포인트/템플릿 방식과 다른 버전이면 그 버전에 맞는 검사를 먼저 준비한다. 템플릿 훅도 없는 이전 버전에 현재 구조를 억지로 덧씌우지 않는다. 위 명령의 `/app/uploads` 등 경로가 이전 버전과 맞는지도 사전 확인한다.

어느 단계든 실패하면 공개 서비스를 열지 말고 원인을 확인한다. 공개 재개 후 검사 실패 시 즉시 해당 프로젝트의 Nginx·백엔드를 다시 중단한다. Docker 제어 자체가 실패하면 공개 차단 여부를 보장할 수 없으므로 별도 네트워크 차단/서버 조치가 필요하다.

실제 계정·외부 도메인·이미지·OAuth 검증 후에만 예약 수집을 재개한다. 검증 중 신규 쓰기가 있었다면 다시 롤백할 때 유실되지 않도록 별도 보존해야 한다.

## 복구 이미지·백업 보존 정책

- 성공 릴리스 **최근 3개와 최소 30일 보존 중 더 많은 범위**를 기본으로 제안한다. 운영 저장 용량/규정에 따라 승인 후 조정한다.
- 현재 실행 이미지, 현재/예정 롤백이 참조하는 이미지, 미해결 실패 분석에 필요한 이미지·DB·업로드는 기간과 무관하게 보존한다.
- 디스크 여유는 배포 전 확인하고, 새 빌드 공간 + DB/업로드 백업 + 별도 복원 공간을 확보한다. `docker system df`와 백업 디렉터리 사용량을 읽기 전용으로 확인한다.
- 정리는 참조 관계를 조사한 뒤 **정확한 태그/백업 경로별로 사람의 승인을 받아** 수행한다. `docker image prune -a`, `down -v`, 포괄적 재귀 삭제를 운영 정리 정책으로 쓰지 않는다.
- 이번 작업에서는 보존 정책만 작성했다. 복구 태그·백업·데이터 볼륨을 자동 삭제하지 않았다. 임시 검사 컨테이너와 검증용 작성 글만 그 생성 주체가 정리했다.
