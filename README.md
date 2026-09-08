# jion

AI에 관심 있는 개발자와 사용자가 좋은 소식을 발견하고, 변화의 의미를 이해하고, 실제 사용 경험을 나누는 한국어 커뮤니티입니다.

- [jionc.com](https://jionc.com): AI 소식·해설·활용법·논문·커뮤니티
- [blog.jionc.com](https://blog.jionc.com): 운영자의 개발·학습 기록

## 현재 운영 상태

2026-09-09 기준, 홈과 편집 본문 개선을 운영에 반영했습니다.

- 기존 **왼쪽 소식 / 오른쪽 커뮤니티** 배치 유지
- ‘함께 볼 소식’ 제목과 **최신 · 인기** 선택 영역을 구분
- 대표 글과 목록의 중복 제거, 추천·댓글 수 표시
- 실제 이미지가 있을 때만 표시하고, 없거나 로딩에 실패하면 텍스트 배치 유지
- 원문 영역은 본문 아래 **원문 제목 링크 하나**로 간소화
- 라운지는 상단·홈에서 제외하되 기존 주소·글·작성 기능과 커뮤니티 보조 링크 보존
- Markdown 편집 본문, 소제목·표·인용 및 관리자 미리보기 지원
- 기존 댓글·대댓글·후기·공유 로그인·기기 설정 기반 테마 유지

현재 DB 리비전은 `202609090001`입니다. 이번 배포에서 기존 글·댓글을 삭제하거나 비공개 원고를 발행하지 않았습니다. 클로드 해설 원고는 로컬 관리 자료이며 이 공개 저장소에는 포함하지 않습니다.

배포 범위·검증·백업과 현재 운영 경로는 [2026-09-09 운영 반영 기록](docs/HOME_EDITORIAL_RELEASE_20260909.md)을 기준으로 확인하세요.

## 콘텐츠 방향

짧은 요약도 필요하지만, 대표 해설은 원문을 열지 않아도 독자의 궁금증에 답해야 합니다.

| 글의 역할 | 제공하는 가치 |
|---|---|
| 소식 | 무엇이 달라졌고 누구에게 해당하는지 |
| 해설 | 뉴스에서 생긴 질문에 대한 설명·사례·한계 |
| 활용법 | 준비 조건·방법·결과 예시·막히는 부분 |
| 경험·후기 | 실제 상황·시도·결과·배운 점 |

소식·연구 해설에는 실습을 의무적으로 붙이지 않습니다. 공식 발표, 외부 고객 사례, 직접 사용, 비교 실험을 구분합니다. 자세한 기준은 [편집 정책](docs/EDITORIAL_POLICY.md), 참고 자료는 [국내외 50곳 비교](docs/AI_CONTENT_BENCHMARK_50_20260909.md)에 있습니다.

### 홈 정렬

- 대표: 조회된 주목할 소식에서 지정된 글 우선 → 본문이 있는 글 → 첫 글. 주목할 소식이 없으면 최신 목록으로 대체합니다.
- 최신: 사이트 게시 시각순. 원문 발표일과 구분합니다.
- 인기: 유효한 누적 추천 ×2 + 서로 다른 댓글 작성 계정 수. 등록 작성자를 제외한 참여 계정이 2개 이상인 글만 대상으로 합니다.
- 반복 댓글·삭제/숨김 댓글·취소한 추천은 순위 기여에서 제외합니다. 조회수·외부 스타는 합산하지 않습니다.
- 화면에는 최신·인기만 표시합니다. 기존 최근 6시간 계산 API는 남아 있지만 홈에서 호출하지 않습니다.

상세 구현 기록: [순위 기준](docs/SIGNAL_RANKING_LOCAL_20260909.md), [홈 조정 이력](docs/HOME_EDITORIAL_LOCAL_20260909.md). 파일명의 LOCAL은 최초 검증 단계이며 현재 운영 반영 여부는 위 배포 기록을 우선합니다.

## 로그인·블로그

두 사이트는 jionc.com의 호스트 전용 HttpOnly 세션 쿠키를 통해 로그인 상태를 공유합니다. 인증 정보는 localStorage에 저장하지 않습니다.

블로그 작성 권한은 설정된 소유자 ID·관리자 여부·이메일 인증을 서버에서 확인합니다. 관리자라는 이유만으로 모든 계정이 블로그 글을 쓸 수 있는 것은 아닙니다.

테마는 기기 설정을 기본으로 따르며, Dark/Light 버튼으로 직접 전환한 선택을 두 사이트에서 공유합니다.

## 기술 스택

- Backend: Python 3.11, FastAPI, SQLAlchemy, Alembic, PostgreSQL 15, Redis 7
- Main frontend: React 18, Vite 7, Tailwind CSS 3, TanStack Query, Zustand
- Blog frontend: React 19, Vite 8, Tailwind CSS 4, React Markdown
- Infra: Docker Compose, Nginx
- Node: `20.19+` 또는 `22.12+`; 검증된 운영 빌드는 Node 22 계열

## 로컬 개발

운영 DB·환경변수·인증키를 로컬에 복사하지 않습니다. `backend/.env.example`을 참고해 독립된 개발 DB, Redis, 시크릿 키와 로그인 origin을 설정하세요. 실제 `.env`는 Git에 올리지 않습니다.

### 기본 Compose

```bash
docker compose up --build
```

개발용 Compose의 기본 DB 자격증명과 열린 포트는 운영용이 아닙니다.

- 메인: http://localhost
- 메인 개발 서버: http://localhost:5173
- API: http://localhost:8000/api/v1
- API 문서: http://localhost:8000/docs

### 개별 실행

서로 다른 터미널에서 실행합니다. Python은 가상환경을 사용하세요.

```bash
# 프로젝트 루트에서 백엔드 의존성 설치
pip install -r backend/requirements.txt

# 개발용 PostgreSQL·Redis 및 backend/.env 설정 후
cd backend
alembic upgrade head
uvicorn app.main:app --reload
```

```bash
# 별도 터미널, 프로젝트 루트에서
npm ci --prefix frontend
npm run dev --prefix frontend
```

```bash
# 블로그를 작업하는 경우
npm ci --prefix frontend-blog
npm run dev --prefix frontend-blog
```

필요하면 메인은 `VITE_API_URL`, 블로그는 `VITE_API_URL`·`VITE_AUTH_ORIGIN`을 로컬 주소로 설정하고 백엔드의 허용 origin과 맞춥니다. 이번 작업의 개인 미리보기 환경인 `.local-preview/`는 공개 저장소와 배포 소스에서 제외합니다.

## AI 수집과 발행

수집원은 `config/signal_sources.json`에서 관리합니다.

```bash
python scripts/collect_ai_signals.py --dry-run --max-items 5
```

dry-run도 공개 피드 조회는 수행하지만 저장·공개는 하지 않습니다.

현재 운영의 수집기 토큰은 설정되지 않았으며, 이번 배포로 자동 수집을 활성화하지 않았습니다. 코드에는 완성된 기존 형식의 수집 글을 자동 공개하는 경로가 남아 있으므로, 토큰을 설정하는 일을 단순한 연결 작업으로 취급하지 마세요.

- 새 편집 본문 `body`가 있는 수집 글은 관리자 검토 대상으로 보냅니다.
- 소식·연구 해설의 관리자 발행에는 본문 또는 활용 포인트가 필요하며 실습은 선택입니다.
- 활용법은 실행 안내도 요구합니다.
- 등록·검토·공개는 서로 다른 단계입니다. 운영 자동화 활성화는 별도 검토 대상입니다.

## 배포와 복구

현재 운영은 검증된 사전 빌드 이미지를 사용합니다. 작은 운영 서버에서 새로 빌드하지 않습니다. 현재 릴리스 경로·Compose 프로젝트·이미지를 먼저 확인하고 이전 폴더의 명령을 재실행하지 마세요.

```bash
# 실제 운영 경로와 사전 빌드 설정을 확인한 기존 설치 갱신에만 사용
bash deploy.sh --confirm-downtime
```

절차는 이전 이미지 보존 → 설정 확인 → 공개 중단 → DB·업로드 백업 → 마이그레이션 → 비공개 Nginx 검사 → 공개 재개입니다. 실패하면 자동으로 공개하거나 DB를 되돌리지 않습니다. 최초 서버 설치용 명령이 아닙니다.

- [현재 운영 반영 기록](docs/HOME_EDITORIAL_RELEASE_20260909.md)
- [통합 배포 검증·운영 절차](docs/INTEGRATED_RELEASE_READINESS.md)
- [롤백 실행 절차](docs/ROLLBACK_RUNBOOK.md)

## 검증

```bash
python -m pytest backend/tests -q
python -m unittest discover -s tests/release -v
node --test tests/theme/theme.test.mjs tests/release/home-stories.test.mjs tests/release/signal-dates.test.mjs
npm run build --prefix frontend
npm run build --prefix frontend-blog
```

이번 운영 배포에서 확인한 결과:

- 백엔드 171개 통과
- Linux 배포 회귀 28개 통과 (일부 배포 검사는 Windows에서 건너뜀)
- 홈·테마·날짜 JavaScript 테스트 18개 통과
- 두 앱 이미지 빌드, 로컬 통합 배포 리허설, 운영 TLS·API·SEO 검사 통과
- 실제 운영 브라우저의 모바일/데스크톱·명암 모드·정렬 전환·원문 링크·블로그 로딩 확인

남은 사항:

- 메인 JS 청크 크기 경고가 있습니다.
- 블로그 전체 lint에는 기존 `BlogCommentThread.jsx`의 `react-hooks/set-state-in-effect` 오류 1건이 남아 있습니다. 이번 홈 작업에서 블로그 소스를 바꾸거나 lint 규칙을 완화하지 않았습니다.
- 실제 Google 로그인 완료와 운영 데이터 규모의 순위 집계 성능은 이번 배포에서 재검증하지 않았습니다.
- 비공개 원고, API 키, 전송 아카이브, 로컬 실행 증거는 공개 저장소에 포함하지 않습니다.

## License

MIT
