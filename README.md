# jion 커뮤니티

풀스택 커뮤니티 서비스입니다.

## 프로젝트 목적 (Portfolio Focus)

- End-to-end 구현 역량 증명: 기획한 기능을 백엔드/프론트엔드/인프라까지 직접 연결
- 운영 관점 역량 증명: 배포 스크립트, 서비스 헬스체크, 환경변수/시크릿 관리, 장애 대응 문서화
- 보안 기본기 증명: 인증 플로우 강화, OAuth 리다이렉트/상태 검증, 민감정보 관리 개선
- 자동화 역량 증명: GitHub Actions 기반 정기 콘텐츠 발행 파이프라인 운영

## 기술 스택

- Backend: Python 3.11, FastAPI, SQLAlchemy, PostgreSQL 15, Redis 7
- Frontend: React 18, Vite, TailwindCSS, Zustand
- Infra: Docker Compose, Nginx, EC2 배포 스크립트 기반 운영

## 아키텍처 요약

- `frontend`(SPA) -> `nginx`(reverse proxy) -> `backend`(FastAPI) -> `postgres`/`redis`
- `docker-compose.yml`: 로컬 개발 실행
- `docker-compose.prod.yml`: 운영 배포 구성
- `deploy.sh`: 운영 서버 배포/마이그레이션/시드 자동 실행

## 최근 작업 정리 (기준일: 2026-03-04)

### 1) 인증/보안
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

### 2) UI/UX 개선
- 커뮤니티 탭 구조 단순화 및 상호작용 일관화
- 팀원모집 전용 탭/라우트 정리
- active/hover 대비, 버튼 컬러, 히어로 카피 등 세부 UI 개선
- 회원가입 화면 개선(닉네임 용어 정리, 인증 코드 입력/버튼 사용성 개선)

### 3) 자동화/운영
- IT 뉴스 자동 발행 파이프라인 유지/보강
  - GitHub Actions 스케줄: 하루 3회(UTC 00:00/08:00/16:00)
  - `dev-news` RSS 피드 목록 업데이트로 수집 안정성 개선
- 관련 문서: [DEV_NEWS_AUTOMATION.md](DEV_NEWS_AUTOMATION.md)

## 핵심 기능

- 로컬 계정 로그인/JWT 인증
- Google/GitHub OAuth 로그인
- 게시글/댓글/좋아요/첨부파일
- 카테고리, 검색, 페이지네이션
- 팔로우/차단, 북마크, 알림
- 커뮤니티 허브(통계/핫글/주간 요약)
- MCP 카테고리/서버/리뷰/플레이그라운드 API

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
│     ├─ api/v1/
│     ├─ models/
│     ├─ schemas/
│     └─ core/
├─ frontend/
│  └─ src/
├─ nginx/
├─ .github/workflows/
├─ docker-compose.yml
├─ docker-compose.prod.yml
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
