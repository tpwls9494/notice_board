# 사내 게시판 시스템

1000명 규모의 사내 게시판 시스템입니다.

## 🚀 기술 스택

### Backend
- Python 3.11
- FastAPI - 빠른 API 프레임워크
- PostgreSQL 15 - 메인 데이터베이스
- Redis 7 - 캐싱
- SQLAlchemy - ORM
- JWT - 인증

### Frontend
- React 18
- Vite - 빌드 도구
- TailwindCSS - 스타일링
- React Query - 서버 상태 관리
- Zustand - 클라이언트 상태 관리
- React Router - 라우팅

### Infrastructure
- Docker & Docker Compose
- Nginx - 리버스 프록시

## 📋 주요 기능

- ✅ 회원가입 / 로그인 (JWT 인증)
- ✅ 게시글 작성 / 조회 / 수정 / 삭제
- ✅ 댓글 작성 / 삭제
- ✅ 페이지네이션
- ✅ 조회수 카운트
- ✅ 작성자/관리자 권한 관리

## 🛠️ 설치 및 실행

### 사전 요구사항
- Docker
- Docker Compose

### 실행 방법

1. **프로젝트 클론**
```bash
cd antigravity
```

2. **Docker Compose로 전체 시스템 실행**
```bash
docker-compose up --build
```

3. **서비스 접속**
- Frontend: http://localhost (Nginx를 통한 접속)
- Backend API: http://localhost/api/v1
- API 문서: http://localhost/docs
- Direct Frontend: http://localhost:5173
- Direct Backend: http://localhost:8000

### 개발 모드 (로컬)

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

## 📁 프로젝트 구조

```
company-board/
├── backend/               # FastAPI 백엔드
│   ├── app/
│   │   ├── api/          # API 엔드포인트
│   │   ├── core/         # 설정, 보안
│   │   ├── models/       # DB 모델
│   │   ├── schemas/      # Pydantic 스키마
│   │   ├── crud/         # CRUD 함수
│   │   └── main.py       # 메인 앱
│   └── requirements.txt
├── frontend/              # React 프론트엔드
│   ├── src/
│   │   ├── components/   # 재사용 컴포넌트
│   │   ├── pages/        # 페이지
│   │   ├── services/     # API 클라이언트
│   │   └── stores/       # 상태 관리
│   └── package.json
├── nginx/                 # Nginx 설정
└── docker-compose.yml     # Docker Compose 설정
```

## 🔧 환경 설정

Backend 환경변수는 `backend/.env` 파일에서 관리됩니다:
```env
DATABASE_URL=postgresql://postgres:password@postgres:5432/company_board
REDIS_URL=redis://redis:6379/0
SECRET_KEY=your-secret-key
```

## 📝 API 엔드포인트

### 인증
- `POST /api/v1/auth/register` - 회원가입
- `POST /api/v1/auth/login` - 로그인
- `GET /api/v1/auth/me` - 내 정보 조회

### 게시글
- `GET /api/v1/posts/` - 게시글 목록
- `GET /api/v1/posts/{id}` - 게시글 상세
- `POST /api/v1/posts/` - 게시글 작성
- `PUT /api/v1/posts/{id}` - 게시글 수정
- `DELETE /api/v1/posts/{id}` - 게시글 삭제

### 댓글
- `GET /api/v1/comments/post/{post_id}` - 댓글 목록
- `POST /api/v1/comments/` - 댓글 작성
- `DELETE /api/v1/comments/{id}` - 댓글 삭제

## 🧪 테스트

API 문서에서 직접 테스트 가능: http://localhost/docs

## 🎯 다음 단계

- [ ] 파일 첨부 기능
- [ ] 검색 기능
- [ ] 좋아요/북마크
- [ ] 실시간 알림 (WebSocket)
- [ ] 관리자 페이지
- [ ] Redis 캐싱 최적화
- [ ] 테스트 코드 작성

## 📄 라이센스

MIT

## 👨‍💻 개발자

Built with ❤️ using FastAPI and React
