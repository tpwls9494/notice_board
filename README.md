# jion 커뮤니티

풀스택 커뮤니티 + 블로그 서비스입니다.

- **jionc.com** — MCP 마켓플레이스 & 커뮤니티
- **blog.jionc.com** — 기술 블로그

## 프로젝트 목적 (Portfolio Focus)

- End-to-end 구현 역량 증명: 기획한 기능을 백엔드/프론트엔드/인프라까지 직접 연결
- 운영 관점 역량 증명: 배포 스크립트, 서비스 헬스체크, 환경변수/시크릿 관리, 장애 대응 문서화
- 보안 기본기 증명: 인증 플로우 강화, OAuth 리다이렉트/상태 검증, 민감정보 관리 개선
- 자동화 역량 증명: GitHub Actions 기반 정기 콘텐츠 발행 파이프라인 운영

## 기술 스택

- Backend: Python 3.11, FastAPI, SQLAlchemy, PostgreSQL 15, Redis 7
- Frontend (메인): React 18, Vite 5, TailwindCSS 3.4, Zustand
- Frontend (블로그): React 19, Vite 8, TailwindCSS 4, React Markdown
- Infra: Docker Compose, Nginx (멀티 도메인), EC2 배포 스크립트 기반 운영

## 아키텍처 요약

- `jionc.com`: `frontend`(SPA) → `nginx` → `backend`(FastAPI) → `postgres`/`redis`
- `blog.jionc.com`: `frontend-blog`(SPA) → `nginx` → 동일 `backend` 공유
- Nginx가 도메인별 프론트엔드 라우팅, API는 단일 백엔드로 프록시
- `docker-compose.yml`: 로컬 개발 실행
- `docker-compose.prod.yml`: 운영 배포 구성 (Dockerfile.nginx에서 두 프론트엔드 멀티스테이지 빌드)
- `deploy.sh`: 운영 서버 배포/마이그레이션/시드 자동 실행

## 최근 작업 정리

### blog.jionc.com — 기술 블로그 (2026-03~04)
- 독립 프론트엔드(`frontend-blog/`) + 백엔드 API 공유 구조로 블로그 서비스 신규 구축
- Markdown 에디터 (라이브 프리뷰, 이미지 드래그&드롭/클립보드 업로드)
- 글 상세: 자동 목차(TOC), Mermaid 다이어그램, 코드 하이라이팅, 이전/다음 글 네비게이션
- 카테고리 시스템: 개발 / AI / CS / 일상 / 회고 (동적 CRUD)
- 관리자 기능: 임시저장(Draft) 관리, 카테고리 추가/삭제, 인라인 수정/삭제
- SEO: 한/영 슬러그 자동 생성, 조회수 트래킹, 썸네일 지원
- Nginx 멀티 도메인 + SSL 설정, Docker 멀티스테이지 빌드

### jionc.com — 인증/보안 (2026-03)
- 회원가입 시 인페이지 이메일 코드 인증 플로우 추가
  - `POST /api/v1/auth/email-verification/send-code`
  - `POST /api/v1/auth/email-verification/confirm-code`
  - `verification_ticket` 미보유 시 가입 차단
- 이메일 인증/코드 전송 경로에 슬라이딩 윈도우 rate limit 적용
- OAuth 로그인 보안 강화
  - 서버 설정 기반 신뢰 리다이렉트 (`OAUTH_FRONTEND_DEFAULT_REDIRECT`)
  - `state` 검증 강화
  - 토큰 전달을 query string이 아닌 URL fragment(`#token=...`)로 전환
- 운영 보안 점검 문서 추가: [SECURITY_OPEN_CHECKLIST.md](SECURITY_OPEN_CHECKLIST.md)
- 민감한 운영 env 파일(`.env.production`, `backend/.env.production`) git 추적 제거

### UI/UX 개선
- 커뮤니티 탭 구조 단순화 및 상호작용 일관화
- 팀원모집 전용 탭/라우트 정리
- active/hover 대비, 버튼 컬러, 히어로 카피 등 세부 UI 개선
- 회원가입 화면 개선(닉네임 용어 정리, 인증 코드 입력/버튼 사용성 개선)

### 자동화/운영
- IT 뉴스 자동 발행 파이프라인 유지/보강
  - GitHub Actions 스케줄: 하루 3회(UTC 00:00/08:00/16:00)
  - `dev-news` RSS 피드 목록 업데이트로 수집 안정성 개선
- 관련 문서: [DEV_NEWS_AUTOMATION.md](DEV_NEWS_AUTOMATION.md)

## 핵심 기능

### jionc.com
- 로컬 계정 로그인/JWT 인증, Google/GitHub OAuth
- 게시글/댓글/좋아요/첨부파일
- 카테고리, 검색, 페이지네이션
- 팔로우/차단, 북마크, 알림
- 커뮤니티 허브(통계/핫글/주간 요약)
- MCP 카테고리/서버/리뷰/플레이그라운드 API
- AI Assistant (글 교정, 제목 생성, 태그 추천 등)

### blog.jionc.com
- Markdown 기반 기술 블로그
- 카테고리별 글 목록/필터링 (개발, AI, CS, 일상, 회고)
- 자동 목차(TOC), Mermaid 다이어그램, 코드 구문 강조
- 이미지 업로드 (드래그&드롭, 클립보드 붙여넣기)
- 임시저장(Draft) 관리, 슬러그 자동 생성, 조회수 트래킹

## 빠른 실행

### 1) 개발 Docker 실행

```bash
docker-compose up --build
```

- Frontend: `http://localhost`
- Backend API: `http://localhost/api/v1`
- Swagger: `http://localhost/docs`

### 2) 로컬 개발 모드

```bash
# backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# frontend
cd frontend
npm install
npm run dev
```

### 3) 운영 배포

```bash
chmod +x deploy.sh
./deploy.sh
```

- 배포 상세: [DEPLOYMENT.md](DEPLOYMENT.md)

## 환경변수/시크릿 관리

- 개발 기본값은 `backend/.env.example`를 참고
- 운영 값은 루트 `.env` 또는 배포 환경 시크릿으로 관리
- `.env`, `.env.production`, `backend/.env.production` 등 민감 파일은 git 추적 제외

## 프로젝트 구조

```text
notice_board/
├─ backend/
│  └─ app/
│     ├─ api/v1/          # auth, posts, comments, likes, files, mcp_*, blog
│     ├─ models/          # User, Post, McpServer, BlogPost, BlogCategory ...
│     ├─ schemas/
│     ├─ crud/
│     ├─ services/        # ai_service, github, mcp_client
│     └─ core/
├─ frontend/              # jionc.com (React 18 + Vite 5)
│  └─ src/
├─ frontend-blog/         # blog.jionc.com (React 19 + Vite 8)
│  └─ src/
│     ├─ pages/           # BlogList, BlogDetail, BlogEditor, DraftsList
│     └─ components/
├─ nginx/                 # 멀티 도메인 설정 (jionc.com + blog.jionc.com)
├─ .github/workflows/
├─ docker-compose.yml
├─ docker-compose.prod.yml
├─ Dockerfile.nginx       # 두 프론트엔드 멀티스테이지 빌드
├─ deploy.sh
├─ DEV_NEWS_AUTOMATION.md
└─ SECURITY_OPEN_CHECKLIST.md
```

## 참고 문서

- 배포 가이드: [DEPLOYMENT.md](DEPLOYMENT.md)
- IT 뉴스 자동 발행: [DEV_NEWS_AUTOMATION.md](DEV_NEWS_AUTOMATION.md)
- 출시 전 보안 체크: [SECURITY_OPEN_CHECKLIST.md](SECURITY_OPEN_CHECKLIST.md)

## License

MIT

## AI Assistant (NEW)

### Environment variables

Add these to backend environment (`backend/.env.example` includes defaults):

```bash
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1
AI_ROUTE_MODEL=gpt-4.1-mini
AI_CHAT_MODEL=gpt-4.1-mini
AI_EDITOR_MODEL=gpt-4.1-mini
AI_EDITOR_FALLBACK_MODEL=gpt-4.1-mini
AI_TIMEOUT_SECONDS=12
AI_EDITOR_TIMEOUT_SECONDS=45
AI_RATE_LIMIT_WINDOW_SECONDS=60
AI_RATE_LIMIT_MAX_REQUESTS=20
AI_CACHE_TTL_SECONDS=180
```

### API endpoints

- `POST /api/ai/route`
- `POST /api/ai/chat` (`source=sidebar_chat`)
- `POST /api/ai/editor/proofread`
- `POST /api/ai/editor/title`
- `POST /api/ai/editor/template`
- `POST /api/ai/editor/tags`
- `POST /api/ai/editor/mask`

### Local run

```bash
# backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# frontend
cd frontend
npm install
npm run dev
```

### Test commands

```bash
# backend AI tests
python -m pytest backend/tests/test_ai_endpoints.py -q -p no:cacheprovider

# backend syntax checks
python -m py_compile backend/app/api/ai.py backend/app/services/ai_service.py backend/app/schemas/ai.py

# frontend checks
npm --prefix frontend run build
```
