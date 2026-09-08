# 본사이트·블로그 통합 배포 검증 및 인계

검증일: 2026-09-06. 범위: `jionc.com` + `blog.jionc.com`의 배포 안전장치와 로컬 격리 리허설.

최신 후속 변경: 본사이트와 블로그의 대댓글/수정/삭제 통일로 DB head가 `202609060002`가 됐다. 아래의 이전 head·테스트 수는 당시 기록이며, 최신 댓글 변경·98개 백엔드 테스트·데이터 보존 및 블로그 페이지 경계 검증은 [댓글 통일 검증](COMMENT_UNIFICATION.md)을 따른다.

**2026-09-06 검증 당시 운영 서버 접속·배포·운영 DB 변경은 하지 않았다. Claude 검토 후 지적 사항을 보완했고 당시 의존성 감사는 0건이다. 격리 롤백까지 통과했지만 실제 서버/계정 확인과 소스 확정 전에는 운영 배포 승인 상태가 아니다.**

2026-09-07 후속: [운영 서버 사전 점검](SERVER_PREFLIGHT_20260907.md) 후 사용자가 통합 배포와 점검 중단을 승인했다. 로컬 사전 빌드 이미지 방식으로 두 사이트를 운영 반영했고 DB head `202609060002`, 서버 검사 20개 및 실제 도메인 6개 화면의 PC/모바일 검사를 통과했다. 현재 운영 경로, 최종 백업, 추가한 배포 검사 10개와 남은 외부 백업/계정 검증 항목은 [운영 배포 결과](PRODUCTION_RELEASE_20260907.md)를 따른다. 아래 내용은 이전 검증 당시의 기록이다.

## Claude 검토 후 보완 — 2026-09-06

최종 잔여 지적도 보완했다. 런북 Bash/YAML 원문을 직접 추출해 이전 Compose + override 병합 및 비공개 후보 선검사 경로로 실행했다. 이전 소스에 검사 스크립트가 없는 조건과 고정 `container_name`을 함께 사용했다. 상세 증거는 [롤백 런북](ROLLBACK_RUNBOOK.md)의 첫 절과 `runbook-verbatim.json`에 있다.

| 지적 | 조치 및 증거 |
| --- | --- |
| 누락 환경변수를 다운타임 전에 탐지하지 못함 | `config --quiet`의 미설정 경고도 실패 처리. 새 이미지에서 entrypoint를 Python으로 바꿔 `check-release-settings.py`만 실행. 필수 문자열 공백/타입 오류 검사. 실제 잘못된 `SMTP_PORT`를 거부하고 입력 값이 로그에 노출되지 않음: `settings-negative.json` |
| 잔존 후보 때문에 중단 후 실패 | 서비스별 컨테이너가 정확히 하나인지, 해당 프로젝트의 one-off가 남았는지 빌드 전/다운타임 전에 검사. 실제 잔존 후보를 만든 테스트에서도 기존 Nginx가 실행 중인 채 차단됨: `stale-negative.json` |
| 운영/리허설 차이 | 아래 조건표로 검증/미검증을 분리. `VITE_API_URL` 빈 값/절대 주소 빌드를 각각 브라우저 검증. 해결된 Compose 설정의 SHA-256을 빌드 전후 비교해 환경 파일 변경도 감지. 원문 설정/비밀값은 기록하지 않음 |
| 롤백 설명만 있음 | [롤백 실행 절차](ROLLBACK_RUNBOOK.md) 추가. 새 격리 프로젝트에서 실패 DB/파일을 남기고 별도 DB·새 볼륨·실제 이전 이미지로 전환: `rollback.json`, `rollback-commands.json` |
| 본사이트 SEO/정적 파일 검사 공백 | 양쪽 robots·sitemap의 응답/XML/origin 검사, JS/CSS/SVG/폰트별 타입 판별. 모르는 확장자는 CSS로 오인하지 않고 응답 상태 검사 |
| 미추적 파일/줄바꿈 | 커밋은 하지 않음. `.gitattributes`는 미추적 상태라도 현재 작업 트리에서는 읽히지만 다른 환경 전달을 보장하지 못함. 기존 인증서 설정 스크립트도 LF로 정규화했고 인증서 발급/갱신은 실행하지 않음 |
| 복구 태그 누적 | 롤백 문서에 최근 3개 및 최소 30일 중 더 넓은 보존 범위, 참조 중/실패 분석 자료 제외, 승인된 개별 정리 정책 작성. 자동 정리하지 않음 |

회귀 테스트는 **18개**, 백엔드는 **85개** 통과했다. 최초 백엔드 재검사에서는 기존 Windows 임시 폴더의 접근 권한 때문에 19개 fixture 생성 오류가 났으며, 워크스페이스의 새 고유 `--basetemp`로 재실행해 85개 통과했다. 제품 테스트 실패를 숨긴 것이 아니라 임시 폴더 문제를 분리한 것이다.

브라우저 빌드 타깃을 고정하는 Node 회귀 테스트 **1개**도 추가했다. Python 배포 테스트 18개와 별도 집계다. Windows에서 Bash/flock 전용 15개가 skip되는 것은 예상 동작이며 Linux 실행 결과로 확인한다.

### 의존성 업데이트 결과

| 패키지 | 최종 lockfile 버전 |
| --- | --- |
| axios | 1.20.0 |
| react-router-dom / react-router | 7.18.3 |
| mermaid | 11.17.2 |
| dompurify | 3.4.14 |
| vite | 7.3.6 |
| @vitejs/plugin-react | 4.7.0 |

먼저 호환 범위 업데이트를 적용했고, 남은 Router/Vite 경고는 범위를 명시해 메이저 업데이트했다. `npm audit fix --force`는 사용하지 않았다. React 18은 유지한다. Node는 `^20.19.0 || >=22.12.0`이 필요하다. [Vite 7 이전 안내](https://v7.vite.dev/guide/migration)의 Node/브라우저 대상 변경 및 [Vite 6 이전 안내](https://v6.vite.dev/guide/migration)를 확인했다. 구형 브라우저 전체에 대한 호환성 검증은 하지 않았다.

원래 lockfile을 별도 디렉터리에서 감사해 **전체 24건(높음 14·중간 8·낮음 2)**을 재현하고 `main-full-audit-before.json`으로 보관했다. 최종 본사이트 전체/런타임과 블로그 전체 감사는 **모두 0건**이며 각 JSON 원본을 보관했다. 감사 0건이 애플리케이션 보안 전체를 보증하는 것은 아니다.

Windows/Node와 Linux Docker 빌드를 통과했다. Router 변경 후 실제 브라우저에서 보호 페이지 → 로그인 → 원래 후기 작성 화면 복귀 → 글 생성 → 편집 → 상세 복귀 → 뒤로/앞으로 이동 → 와일드카드 리다이렉트 → 일반 회원 관리 화면 차단을 확인했다. 검증용으로 생성한 글만 제거했다. 기존 휴면 Markdown/도표 화면 전체를 다시 활성화하거나 전수 검사한 것은 아니다.

### 운영 설정과 리허설의 차이

| 조건 | 확인한 범위 | 여전히 필요한 확인 |
| --- | --- | --- |
| 고정 `container_name` | 이전 검토의 별도 실측에 더해, 런북 원문 리허설에서도 고정 이름 4개와 `compose run --name` 후보의 공존/교체를 확인 | 운영의 실제 프로젝트명·기존 컨테이너 소유 관계 확인 |
| `restart: unless-stopped` | 새 롤백 프로젝트 4개 컨테이너의 실제 RestartPolicy 확인 | 운영 Docker 재시작/서버 재부팅 동작은 미검증 |
| 인증서·ACME bind mount | 로컬 인증서 폴더 → `/etc/letsencrypt/live/jionc.com:ro`, 테스트 webroot → `/var/www/certbot` 실제 마운트 및 파일 확인 | 운영 `/etc/letsencrypt` 권한·갱신 링크·실제 webroot·ACME 발급/갱신 |
| TLS 신뢰 | 실제 도메인 SNI/호스트명과 로컬 CA로 체인 검증, 인증서 검증 비활성화 없이 내부 검사 | 시스템 CA로 운영 Let's Encrypt 체인/만료일 검증 |
| `VITE_API_URL` 비어 있음 | `window.location.origin` 경로, 양쪽 홈 및 본사이트 로그인/작성 이동, localhost 28443 | 운영 env 실제 값 확인 |
| `VITE_API_URL=https://jionc.com:28443` | 절대 주소 인자로 실제 재빌드 후 동일 브라우저/API 흐름 통과 | 운영 `https://jionc.com`의 실제 배포 결과, 다른 API origin을 쓰면 CORS/인증/자산 URL 검증 |

절대 주소 테스트 값의 `:28443`은 로컬 리허설 전용이다. 운영 `.env`에 복사하면 안 된다. 운영은 API를 같은 origin으로 제공한다면 `VITE_API_URL=`을 명시하는 방식이 간단하지만 실제 값을 읽기 전에는 변경하지 않는다. 배포 검사에서는 비어 있거나 인증정보·경로·쿼리·fragment 없는 HTTPS origin만 허용한다. 다른 origin이 유효한 HTTPS라는 이유만으로 실제 연결까지 검증됐다고 판단하지 않는다.

### 브라우저 호환 기준 결정

이번 보안 업데이트 때문에 기존 빌드 호환 목표를 자동으로 올리지 않는다. `frontend/vite.config.js`의 `build.target`을 `['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']`로 명시했다. 이는 [Vite 5.4.21 원본의 modules 타깃](https://github.com/vitejs/vite/blob/v5.4.21/packages/vite/src/node/constants.ts#L19)과 같다.

이 값은 **빌드 구문 변환의 호환 목표**이며 Chrome 87/Edge 88/Firefox 78/Safari 14에서 전 기능 테스트가 완료됐다는 뜻은 아니다. 브라우저 API를 자동 폴리필하지 않으며, CSS·서드파티 라이브러리·실제 구형 브라우저 동작은 별도 확인이 필요하다. 구형 브라우저 전수 지원을 새로 보증하지 않는다.

명시적 타깃으로 Windows 빌드, Linux 통합 이미지 빌드, 현재 Chrome의 양쪽 홈·모바일 폭·로그인/작성/편집/뒤로·앞으로 이동 검사를 다시 통과했다. `node --test tests/release/browser-target.test.mjs`로 타깃이 의도치 않게 바뀌지 않는지 확인한다.

## 이번 변경

| 파일 | 변경 이유 |
| --- | --- |
| `deploy.sh` | 점검 시간 명시 확인, 동시 실행 잠금, 이전 이미지 보존, 빌드 전후 소스 비교, 서비스 중단 후 백업, 마이그레이션 단일 실행, 비공개 Nginx 검사 후 재개 |
| `scripts/release-common.sh` | Compose 프로젝트 선택 및 실행/중단 상태 검사 공통화 |
| `scripts/backup-release.sh` | 실행 중인 앱의 백업 거부, 이전 이미지와 읽기 전용 마운트로 업로드 백업, 정확한 백업 경로 반환, DB revision·볼륨·복구 이미지 참조 기록 |
| `scripts/release-manifest.py` | 미추적 파일을 포함한 배포 소스 SHA-256 목록. DB·업로드·환경 비밀값·빌드 결과 제외 |
| `scripts/check-release.py` | DB head, Redis, 상세 health, 공유 블로그 템플릿, 두 사이트 HTML·JS·CSS, 공개 글 메타, noindex/404, robots/sitemap/OG 검사 |
| `scripts/check-release-settings.py` | 새 이미지의 설정 로딩 실패를 다운타임 전에 검사하며 오류 입력 값을 숨김 |
| `scripts/check-release-compose.py` | 해결된 설정을 저장하지 않고 해시/안전한 빌드 사실만 기록, 잘못된 API origin 차단 |
| `docker-compose.prod.yml` | 운영 앱 시작 시 중복 마이그레이션 제거, PostgreSQL healthcheck가 실제 사용자/DB 설정 사용 |
| `backend/.dockerignore` | 커뮤니티뿐 아니라 블로그·기존 업로드 전체를 이미지에서 제외 |
| `.dockerignore` | 환경 예제 파일의 광범위한 예외 규칙을 좁혀 제외된 로컬 테스트 폴더를 다시 순회하지 않도록 수정 |
| `.gitattributes` | Bash 스크립트 LF 줄바꿈 고정 |
| `tests/release/test_deploy.py` | 실제 Docker를 호출하지 않는 배포 성공/실패/잠금 회귀 테스트 |

화면 기능, 계정 권한, 소식 수집 로직은 이번 단계에서 변경하지 않았다. 프런트엔드 패키지는 위 표의 보안 업데이트를 적용했다.

## 현재 실행 순서

후속 UI 변경 참고: 로고와 라운지 이스터에그가 이 통합 검증 기록 이후 수정됐다. 상세 범위와 프런트엔드 검증은 `JION_MAIN_SITE_REDESIGN.md`의 로고·라운지 절에 기록한다. 배포 스크립트/백엔드/DB는 바꾸지 않았지만, 이전 `candidate-source.json`을 최신 UI의 소스 해시로 취급하면 안 된다. 운영 반영 시 최신 UI를 포함해 소스를 다시 확정한다.

기존 설치 갱신 전용이다. PostgreSQL·Redis·백엔드·Nginx가 이미 실행 중이어야 한다. 신규 설치를 자동 생성하거나 DB/Redis 컨테이너를 갱신하는 스크립트가 아니다.

1. 운영 서버/절대 프로젝트 경로, 실제 Compose 프로젝트 이름, 기존 DB revision 및 볼륨을 읽기 전용으로 확인한다.
2. 두 세션의 변경을 함께 검토해 고정된 커밋 또는 검증된 소스 묶음으로 확정한다. 미추적 Python/React/마이그레이션 파일도 누락 없이 포함한다. 본사이트 정적 ZIP만 사용하면 안 된다.
3. 기존 배포의 Compose 설정과 환경 파일을 서버의 보호된 위치에 따로 보존한다. 아래 백업의 `compose-source.yml`은 실행 시점의 **후보 설정**이지 과거 설정의 복원이 아니다. 비밀값을 채팅/검증 보고서에 넣지 않는다.
4. 점검 시간을 공지하고 예약 수집, 수동 수집, DB에 직접 쓰는 외부 작업을 중단한다. 스크립트가 GitHub Actions/외부 DB 클라이언트까지 중단하지는 않는다.
5. Linux Bash, Python 3, Docker Compose, `flock`, GNU/coreutils, 백업 디스크 여유 공간과 양쪽 도메인을 포함하는 TLS 인증서를 확인한다.
6. 승인된 점검 시간에 한 번 실행한다.

```bash
bash deploy.sh --confirm-downtime
```

내부 동작:

`설정 누락 검사 → 잠금/잔존 컨테이너 검사 → 이전 이미지에 복구 태그 부여 → 소스·설정 해시 → 두 프런트엔드/백엔드 빌드 → 소스·설정 해시 재확인 → 새 이미지 설정 로딩/잔존 컨테이너 재검사 → Nginx/백엔드 중단 → DB·업로드 백업 → 같은 DB에 마이그레이션 → 새 백엔드 → 포트를 공개하지 않은 후보 Nginx 검사 → 공개 Nginx 재개 → 재검사`

- 빌드는 기존 서비스 실행 중 수행한다. 중단 이후에는 **두 사이트 모두 접속할 수 없는 점검 시간**이 발생한다. 무중단 배포가 아니다.
- 백업 스크립트는 내부에서 한 번 실행된다. 같은 절차 앞에서 수동으로 중복 실행할 필요가 없다.
- 마이그레이션의 별도 컨테이너는 별도 테스트 DB가 아니다. 실제 대상 DB를 변경한다.
- 후보 Nginx에는 호스트 포트가 없음을 확인한다. 시작 훅이 공유 볼륨에 블로그 템플릿을 채운 뒤 검사한다.
- 검사 연결은 내부 컨테이너 주소로 보내되 실제 도메인으로 TLS 체인과 호스트명을 검증한다. 운영에서 인증서 검증을 끄지 않는다.
- 신규 공개 Nginx를 시작하면 사용자 접속도 재개된다. 직후 재검사가 실패하면 Nginx/백엔드를 다시 중단한다. 이후 실제 계정 점검까지 자동으로 쓰기를 잠그는 구조는 아니다.
- `down`, 볼륨 삭제, 이미지 정리, 자동 DB 복원은 실행하지 않는다.

7. 실제 외부 네트워크에서 양쪽 도메인/DNS/인증서, 로그인, 후기·댓글, 블로그 작성·수정·프로필·이미지를 확인한다. 운영 글을 임의로 만들지 말고 검증 계정/데이터 범위를 먼저 승인받는다.
8. Google/GitHub 실제 로그인과 이메일 관련 기능은 계정 소유자가 확인한다. 정상 확인 후 예약 수집 등 외부 작업을 재개한다.

`RELEASE_COMPOSE_FILE`과 `RELEASE_PROJECT_NAME`은 격리 리허설 또는 확인된 실제 프로젝트를 선택할 때만 사용한다. 다른 프로젝트를 실수로 선택하면 안 된다. 운영 환경에서 리허설용 환경변수/인증서를 사용하지 않는다.

## 실패 및 복구

- 빌드/소스 변경 감지 단계 실패: 공개 서비스는 계속 실행한다. 생긴 복구 태그와 준비 기록은 남긴다.
- 중단 이후 실패: 공개 Nginx와 백엔드를 중단 상태로 남긴다. 백업 경로와 준비 기록을 확인한다. 실패 단계에 따라 DB가 이미 변경됐을 수 있으므로 무조건 `up`하거나 재실행하지 않는다.
- 마이그레이션 전 실패임이 확인되면 기존 컨테이너와 기존 이미지/설정을 검토해 재개할 수 있다. 스크립트가 판단해서 자동 재개하지 않는다.
- 마이그레이션 이후에는 이전 코드와 현재 스키마의 호환성을 먼저 판단한다. 필요하면 덤프를 **별도 DB**에 복원해 검증하고, 해당 시점의 업로드·이전 이미지·기존 환경/Compose 설정을 함께 맞춰 전환한다.
- 이전 Nginx 이미지로 시작하면 그 이미지의 블로그 템플릿을 공유 볼륨에 다시 복사한다.
- 백업의 `*.rollback-image.txt`와 `*.image-id`는 이미지 참조다. 이미지 바이너리를 `docker save`한 파일이 아니다. 복구 태그와 로컬 이미지를 보존하고, 운영 정책에 따라 별도 이미지 저장소/오프호스트 백업도 준비해야 한다.
- `working-tree-head.txt`는 현재 작업 폴더 HEAD이며 이전 실행 이미지의 소스 커밋을 보증하지 않는다. `candidate-source.json`은 후보 소스 해시이고 소스 파일 아카이브가 아니다.
- 백업은 민감한 DB/파일을 포함하므로 접근을 제한한다. Linux에서 `umask 077`을 적용하지만, Windows 공유 마운트의 ACL까지 보장하지는 않는다.

## 이번 검증 결과

격리 프로젝트 `jion-integrated-20260906`, 새 PostgreSQL/업로드/템플릿/인증서 볼륨과 localhost `28080/28443` 포트만 사용했다. 기존 `jion-preflight-*`, `jion-blog-release-*` 프로젝트 및 운영 DB에는 배포하지 않았다.

| 검사 | 결과 |
| --- | --- |
| 기존 백엔드 테스트 | 85개 통과 |
| 배포 회귀 테스트 | 18개 통과: 기존 10개 + 환경 누락/타입/변경, 잔존 후보/중복 컨테이너, Docker 중단 실패 경고, 자산 MIME, Compose 요약/비밀값 검사 |
| Linux 통합 이미지 | 실제 `Dockerfile.nginx`로 두 프런트엔드 + 백엔드 빌드 성공 |
| 빈 PostgreSQL | 전체 마이그레이션 `202609050004`까지 성공 |
| 실제 배포 스크립트 | 이미지 보존 → 중단 → 백업 → 마이그레이션 → 비공개 검사 → 재개 성공 |
| Nginx/TLS | 양쪽 호스트명 검증, HTML과 연결된 정적 파일, 블로그 공유 템플릿 검사 통과 |
| 격리 계정/API | 일반/작성자 로그인, 본사이트 글 생성·수정·삭제·댓글·답글, 블로그 글 생성·수정·삭제·좋아요·댓글·권한 확인 |
| 블로그 비공개 글 | HTML 404, 제목/본문 비노출, 사이트맵 제외 확인 |
| 이미지 | 3,147,861바이트 PNG 업로드, 커뮤니티 WebP 변환, 블로그 원본 일치, 프로필 업로드/초기화, 초과 요청 413 |
| 데이터 보존 | 사용자 2명, 커뮤니티 글 1·댓글 2, 블로그 글 1·좋아요 1·댓글 1 및 스키마 체크섬이 재배포 전후 일치 |
| 백업 복원 | 별도 DB 복원 후 같은 체크섬. 업로드 아카이브의 파일 내용 해시도 기존 파일과 일치 |
| 브라우저 | 실제 운영 빌드의 양쪽 홈, 동일 출처 API, JS/CSP 오류 없음, 390px 모바일 가로 넘침 없음 |

리허설에서 이전 이미지의 가변 태그가 빌드로 옮겨진 뒤 예전 이미지 ID를 찾지 못하는 문제를 실제 발견했다. 마이그레이션 전에 실패함을 확인했고, **빌드 전 복구 태그 보존**으로 보완한 뒤 정상 흐름을 다시 통과했다.

테스트 DB/이미지는 재검증을 위해 남긴다. 실제 운영 계정의 Google/GitHub 인증, 이메일 수신, 운영 DNS/인증서, 대용량 운영 DB의 점검 시간, 운영 롤백 전환은 이번 결과에 포함되지 않는다. 브라우저의 임시 인증서 예외는 별도 검증 브라우저에서만 적용했고, OS 신뢰 저장소에 인증서를 설치하지 않았다.

## 아직 남은 운영 전 확인 사항

1. 의존성 경고는 위 후속 업데이트로 0건이 됐다. 최종 변경에 대한 별도 검토와 운영 배포 승인은 여전히 필요하다.
2. 실제 운영 서버 접속 정보·절대 프로젝트 경로·기존 Compose 프로젝트 이름과 배포 범위 확정.
3. 미추적 파일을 포함한 소스 버전 확정 및 기존 운영 설정/이미지/백업 보존 확인.
4. 실제 계정의 OAuth·이메일 확인과 점검 시간 승인.

## 증거 위치 및 재검증

상대 경로 기준:

- `.local-preview/integrated-release/deployment.stdout`, `deployment.stderr`: 실제 배포 실행 로그.
- `.local-preview/integrated-release/guards.stderr`: 배포 테스트 18개 결과.
- `.local-preview/integrated-release/flows.json`: 양쪽 쓰기/이미지/권한 검증 결과.
- `.local-preview/integrated-release/before.json`, `after.json`, `restore.json`: 재배포/복원 체크섬.
- `.local-preview/integrated-release/browser.json`, `jionc.com.png`, `blog.jionc.com.png`: 실제 브라우저 증거.
- `.local-preview/integrated-release/main-full-audit-before.json`: 원래 lockfile의 전체 24건 감사 재현.
- `.local-preview/integrated-release/main-full-audit.json`, `main-runtime-audit.json`, `blog-full-audit.json`: 업데이트 후 전체/런타임/블로그 0건 감사 원본.
- `.local-preview/integrated-release/settings-negative.json`, `stale-negative.json`: 실제 설정 오류와 잔존 후보 조기 차단 증거.
- `.local-preview/integrated-release/browser-empty-api.json`, `navigation-empty-api.json`, `browser-absolute-api.json`, `navigation-absolute-api.json`: API 빌드 인자별 브라우저 결과.
- `.local-preview/integrated-release/rollback.json`, `rollback-commands.json`, `rollback-selection.json`: 실제 구버전 이미지 전환, 별도 DB/볼륨 복구 결과와 고정된 테스트 선택 값.
- `.local-preview/integrated-release/runbook-verbatim.json`: 런북 원문 블록 해시, Compose 병합, 고정 이름, 이전 소스와 검사 체크아웃 분리, 비공개 후보 우선 실행 결과. 상세 로그는 그 파일의 `fixture` 경로에 있다.
- `backups/preparation-*/`: 소스/해결된 설정 해시, `settings-check.json`, 후보 컨테이너 ID, 후보/공개 검사 JSON, 실제 백업 경로. 실패한 시도의 디렉터리도 남는다.
- `backups/release-*/`: 덤프·업로드·체크섬·복구 이미지 참조. `candidate-source.json`이 없는 불완전 백업은 성공 백업으로 사용하지 않는다.

회귀 테스트(실제 Docker를 대체하는 가짜 실행기, Linux):

```bash
python3 -m unittest discover -s tests/release -v
python3 -m pytest backend/tests -q
bash -n deploy.sh
bash -n scripts/backup-release.sh
bash -n scripts/release-common.sh
docker compose -f docker-compose.prod.yml config --no-interpolate --quiet
```

Windows에서 기존 pytest 임시 폴더 권한 문제가 있으면, 저장소 루트에서 기존 폴더를 삭제하지 말고 새 경로를 사용한다.

```powershell
$releaseTestTemp = Join-Path (Get-Location) ('.local-preview/backend-tests-' + [guid]::NewGuid().ToString('N'))
python -m pytest backend/tests -q --disable-warnings --basetemp $releaseTestTemp
```

앞선 기본 API 설정 리허설 기록은 `backups/preparation-20260906T102401Z-1-h2qFZV/`, 백업은 `backups/release-20260906T102415Z-QQNGkG/`다. 절대 API 주소 조건의 설정 기록은 `backups/preparation-20260906T101525Z-1-wr4rHa/config-before.json`이다. 실제 구버전 전환 롤백은 앞선 보안 업데이트 전 이미지가 보존된 `release-20260906T100501Z-lx39PV`를 사용했다. 이들은 모두 로컬 테스트 자료다.

명시적 브라우저 타깃을 반영한 후속 통합 리허설은 `backups/preparation-20260906T104436Z-1-MIv7WS/`, 백업은 `backups/release-20260906T104459Z-6p7Exl/`에 있다. 위 이전 기록은 당시 조건별 검증 증거로 보존한다.

격리 리허설 재실행 도구는 `.local-preview/integrated-release/run-evidence.py`에 있다. 로컬 경로이므로 Git에 포함되지 않는다. `deploy`는 해당 고정 테스트 프로젝트만 갱신하며, `flows`는 테스트 데이터를 추가한다. 운영을 대상으로 이 도구를 사용하지 않는다.

## Claude 검토 요청문

> `docs/INTEGRATED_RELEASE_READINESS.md`와 `docs/ROLLBACK_RUNBOOK.md`를 읽고 이전 검토에서 지적한 7개 항목을 다시 확인해줘. 다운타임 전 환경/잔존 컨테이너 검사, 설정 변경 감지, 실제 구버전 이미지·DB·업로드 롤백 증거, API 빌드 인자별 브라우저 결과, 의존성 감사 24→0건 근거를 실제 코드/증거와 대조해줘. Router/Vite 메이저 변경의 회귀 위험과 수동 복구 명령도 확인해줘. 기존 변경과 미추적 파일을 보존하고, 운영 배포나 자동 수정은 하지 말고 심각도·파일 위치·근거·재현 방법을 정리해줘. 실제 운영에서 아직 검증하지 못한 부분을 로컬 검증과 구분해줘.
