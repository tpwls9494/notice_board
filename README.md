# 사내 게시판

Antigravity 1000명 규모의 사내 게시판 시스템입니다.

## 기술 스택

### Backend
- Python 3.11 / FastAPI
- PostgreSQL 15 / Redis 7
- SQLAlchemy ORM / JWT 인증

### Frontend
- React 18 / Vite
- TailwindCSS (Monotone Soft 디자인 시스템)
- React Query / Zustand / React Router

### Infrastructure
- Docker & Docker Compose
- Nginx 리버스 프록시

## 주요 기능

- 회원가입 / 로그인 (JWT 인증)
- 게시글 CRUD (작성 / 조회 / 수정 / 삭제)
- 댓글 작성 / 삭제
- 좋아요 (토글)
- 파일 첨부 / 다운로드
- 카테고리 필터링
- 검색 (제목 / 내용)
- 페이지네이션
- 조회수 카운트
- 작성자 / 관리자 권한 관리

## 디자인 시스템

**Monotone Soft** 테마를 적용한 깔끔한 모노톤 UI입니다.

- **색상**: 순수 뉴트럴 그레이 스케일 (Tailwind neutral)
- **서체**: Pretendard (한/영 통합 Sans-serif)
- **그림자**: 저 불투명도 뉴트럴 소프트 섀도
- **접근성**: `prefers-reduced-motion` 지원, `aria-hidden` / `aria-label` / `role="alert"` 적용
- **가이드라인**: [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) 준수

## 설치 및 실행

### 사전 요구사항
- Docker & Docker Compose

### Docker Compose 실행 (개발)

```bash
docker-compose up --build
```

### 프로덕션 배포 (EC2)

```bash
# 환경변수 설정
cp .env.production .env
nano .env  # 실제 값으로 변경

# 배포
chmod +x deploy.sh
./deploy.sh
```

상세 배포 가이드는 [DEPLOYMENT.md](DEPLOYMENT.md)를 참고하세요.

### 서비스 접속
| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost |
| Backend API | http://localhost/api/v1 |
| API 문서 (Swagger) | http://localhost/docs |

### 개발 모드 (로컬)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## 프로젝트 구조

```
antigravity/
├── backend/
│   ├── app/
│   │   ├── api/v1/        # API 엔드포인트 (auth, posts, comments, likes, files, categories)
│   │   ├── core/          # 설정, 보안 (JWT)
│   │   ├── models/        # SQLAlchemy 모델
│   │   ├── schemas/       # Pydantic 스키마
│   │   ├── crud/          # CRUD 함수
│   │   ├── db/            # DB 세션, Base
│   │   └── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── Dockerfile.prod
├── frontend/
│   ├── src/
│   │   ├── components/    # Layout
│   │   ├── pages/         # Login, Register, PostList, PostDetail, PostForm
│   │   ├── services/      # API 클라이언트 (Axios)
│   │   └── stores/        # Zustand (auth, categories)
│   ├── index.html
│   ├── tailwind.config.js
│   ├── package.json
│   ├── Dockerfile
│   └── Dockerfile.prod
├── nginx/
│   ├── nginx.conf
│   └── nginx.prod.conf
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile.nginx
├── deploy.sh
└── DEPLOYMENT.md
```

## API 엔드포인트

### 인증
- `POST /api/v1/auth/register` - 회원가입
- `POST /api/v1/auth/login` - 로그인
- `GET /api/v1/auth/me` - 내 정보 조회

### 게시글
- `GET /api/v1/posts/` - 게시글 목록 (페이지네이션, 검색, 카테고리 필터)
- `GET /api/v1/posts/{id}` - 게시글 상세
- `POST /api/v1/posts/` - 게시글 작성
- `PUT /api/v1/posts/{id}` - 게시글 수정
- `DELETE /api/v1/posts/{id}` - 게시글 삭제

### 댓글
- `GET /api/v1/comments/post/{post_id}` - 댓글 목록
- `POST /api/v1/comments/` - 댓글 작성
- `DELETE /api/v1/comments/{id}` - 댓글 삭제

### 좋아요
- `POST /api/v1/likes/posts/{post_id}` - 좋아요
- `DELETE /api/v1/likes/posts/{post_id}` - 좋아요 취소

### 파일
- `POST /api/v1/files/upload/{post_id}` - 파일 업로드
- `GET /api/v1/files/post/{post_id}` - 게시글 첨부파일 목록
- `GET /api/v1/files/download/{file_id}` - 파일 다운로드
- `DELETE /api/v1/files/{file_id}` - 파일 삭제

### 카테고리
- `GET /api/v1/categories/` - 카테고리 목록
- `POST /api/v1/categories/` - 카테고리 생성 (관리자)

## 환경 설정

프로덕션 환경변수는 `.env.production`을 `.env`로 복사 후 실제 값으로 변경합니다.

```env
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD
SECRET_KEY=YOUR_SECRET_KEY          # openssl rand -hex 32
VITE_API_URL=http://YOUR_EC2_IP
CORS_ORIGINS=http://YOUR_EC2_IP
```

## 라이센스

MIT
