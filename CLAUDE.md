# CLAUDE.md — Antigravity MCP Marketplace

## 프로젝트 개요
MCP(Model Context Protocol) 서버를 발견, 테스트, 설치할 수 있는 마켓플레이스 플랫폼.
기존 사내 게시판 코드를 커뮤니티 탭으로 재활용하고, MCP 마켓플레이스를 새로 추가하는 구조.

## 플랫폼 구조
```
메인: MCP 마켓플레이스
├── MCP 목록/검색        # 카테고리별 MCP 서버 브라우징
├── MCP 상세             # 설명, README, 설치 가이드, 리뷰
├── 플레이그라운드        # 웹에서 실제 MCP 서버 연결 및 tool 호출 테스트
└── 설치 가이드           # Claude Desktop/Cursor 등 클라이언트별 설치법

커뮤니티 탭 (기존 게시판 재활용)
├── 질문/답변
├── 사용 후기
├── 추천/요청
└── 팁/가이드
```

## 기술 스택
- **Backend**: Python 3.11, FastAPI 0.109, SQLAlchemy 2.0, Pydantic 2.5, Alembic, JWT(python-jose), bcrypt
- **Frontend**: React 18, Vite 5, TailwindCSS 3.4, Zustand, React Query 5, React Hook Form + Zod, Axios
- **Infra**: Docker Compose, Nginx reverse proxy, PostgreSQL 15, Redis 7
- **MCP 연동**: 백엔드에서 실제 MCP 서버에 연결하여 tool 호출 (플레이그라운드)

## 데이터 모델 (계획)

### 새로 추가 — MCP 마켓플레이스
- **McpServer**: MCP 서버 정보 (이름, 설명, 카테고리, GitHub URL, 설치 명령어, 큐레이션 정보)
- **McpTool**: 각 MCP 서버가 제공하는 tool 목록 (이름, 설명, 파라미터 스키마)
- **McpCategory**: MCP 카테고리 (개발도구, 데이터, AI, 생산성 등)
- **McpReview**: 사용자 리뷰/평점
- **McpInstallGuide**: 클라이언트별 설치 가이드 (Claude Desktop, Cursor 등)

### 기존 유지 — 커뮤니티
- **Post**: 게시글 (카테고리를 질문/후기/추천/팁으로 변경)
- **Comment**: 댓글
- **Like**: 좋아요
- **User**: 사용자 (기존 유지)
- **File**: 첨부파일

## 실행 방법
```bash
# 개발 환경 (Docker)
docker-compose up --build

# 로컬 개발 - Backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload

# 로컬 개발 - Frontend
cd frontend && npm install && npm run dev
```

## 프로젝트 구조 (목표)
```
backend/app/
├── api/v1/
│   ├── auth.py           # 인증 (기존)
│   ├── posts.py          # 커뮤니티 게시글 (기존 재활용)
│   ├── comments.py       # 댓글 (기존)
│   ├── likes.py          # 좋아요 (기존)
│   ├── files.py          # 첨부파일 (기존)
│   ├── mcp_servers.py    # [신규] MCP 서버 CRUD, GitHub 연동
│   ├── mcp_playground.py # [신규] MCP 서버 연결 및 tool 호출
│   └── mcp_categories.py # [신규] MCP 카테고리
├── models/               # SQLAlchemy 모델 (기존 + MCP 모델 추가)
├── schemas/              # Pydantic 스키마 (기존 + MCP 스키마 추가)
├── crud/                 # CRUD 함수 (기존 + MCP CRUD 추가)
├── services/
│   ├── mcp_client.py     # [신규] MCP 서버 연결/tool 호출 서비스
│   └── github.py         # [신규] GitHub API 연동 (스타, README 등)
├── core/                 # 설정, 보안 (기존)
├── db/                   # DB 세션 (기존)
└── main.py

frontend/src/
├── pages/
│   ├── marketplace/      # [신규] MCP 마켓플레이스 페이지들
│   │   ├── McpList.jsx        # MCP 서버 목록/검색
│   │   ├── McpDetail.jsx      # MCP 서버 상세
│   │   └── McpPlayground.jsx  # 플레이그라운드
│   ├── community/        # [기존 재활용] 커뮤니티 탭
│   │   ├── PostList.jsx
│   │   ├── PostDetail.jsx
│   │   └── PostForm.jsx
│   ├── Login.jsx         # (기존)
│   └── Register.jsx      # (기존)
├── components/
│   ├── Layout.jsx        # 네비게이션에 마켓플레이스/커뮤니티 탭 추가
│   └── marketplace/      # [신규] MCP 관련 컴포넌트
├── services/api.js       # API 함수 (기존 + mcpAPI 추가)
├── stores/               # Zustand 스토어 (기존 + MCP 스토어 추가)
└── index.css             # Tailwind 커스텀 클래스
```

## 코드 컨벤션

### Backend
- 함수명: snake_case (`get_mcp_server`, `create_review`)
- 모델명: PascalCase 단수형 (`McpServer`, `McpTool`)
- 임포트: `from app.models import ...`, `from app.core.config import settings`
- API 경로: `/api/v1/{resource}` (예: `/api/v1/mcp-servers/`, `/api/v1/mcp-playground/`)
- 에러: `HTTPException(status_code=..., detail="...")`
- 페이지네이션: `page`, `page_size` 쿼리 파라미터

### Frontend
- 컴포넌트 파일: PascalCase.jsx (`McpList.jsx`, `McpDetail.jsx`)
- 스토어: `use{Name}Store` 패턴
- API 호출: `services/api.js`의 그룹별 객체 사용 (`mcpAPI.getServers()`)
- 에러 처리: `error.response?.data?.detail`

### 스타일링
- Tailwind 커스텀 색상: `ink`(어두운 톤), `paper`(밝은 톤), `accent`(그레이)
- 커스텀 폰트: Pretendard, Noto Sans KR
- 커스텀 클래스: `input-field`, `btn-primary`, `btn-secondary`, `card`, `card-hover`, `badge-default`
- 애니메이션: `animate-fade-in`, `animate-fade-up`, `animate-slide-down`

## 인증 방식
- JWT (HS256), 24시간 만료
- localStorage에 토큰 저장
- Axios 인터셉터로 자동 Bearer 토큰 첨부
- 401 응답 시 자동 로그인 페이지 리다이렉트

## DB 패턴
- 타임스탬프: `created_at`, `updated_at` (자동)
- cascade delete로 관계 데이터 정리
- `back_populates`로 양방향 관계
- 유니크 제약조건 (예: 리뷰 중복 방지)

## 주의사항
- `.env` 파일은 커밋하지 않음
- 기존 게시판 코드는 커뮤니티 탭으로 재활용 — 삭제하지 말 것
- 새 기능은 기존 패턴(CRUD 분리, 스키마 분리)을 따를 것
- 플레이그라운드는 백엔드에서 실제 MCP 서버에 연결하는 방식
- MCP 서버 데이터: DB 큐레이션 + GitHub API 실시간 보완 (혼합)
