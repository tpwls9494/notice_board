# EC2 배포 가이드

## 사전 준비

### 1. EC2 인스턴스 생성
- **AMI**: Ubuntu 22.04 LTS
- **Instance Type**: t3.medium 이상 권장 (t2.micro는 메모리 부족 가능)
- **Storage**: 20GB 이상
- **Security Group** 설정:
  - SSH (22): Your IP
  - HTTP (80): 0.0.0.0/0
  - HTTPS (443): 0.0.0.0/0 (선택사항)

### 2. EC2 접속
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

## 배포 단계

### 1. 시스템 업데이트 및 Docker 설치

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose 설치
sudo apt install docker-compose-plugin -y

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

# 로그아웃 후 재로그인 (또는 newgrp docker 실행)
newgrp docker

# Docker 버전 확인
docker --version
docker compose version
```

### 2. Git 설치 및 코드 클론

```bash
# Git 설치
sudo apt install git -y

# 프로젝트 클론
git clone YOUR_REPOSITORY_URL
cd antigravity
```

### 3. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.production .env

# .env 파일 수정
nano .env
```

**필수 변경 항목:**
```bash
# 강력한 비밀번호로 변경
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# 새로운 시크릿 키 생성 및 입력
# 생성 명령: openssl rand -hex 32
SECRET_KEY=YOUR_GENERATED_SECRET_KEY_HERE

# DATABASE_URL의 비밀번호도 동일하게 변경
DATABASE_URL=postgresql://postgres:YOUR_STRONG_PASSWORD_HERE@postgres:5432/company_board

# EC2 Public IP 또는 도메인으로 변경
VITE_API_URL=http://YOUR_EC2_PUBLIC_IP
```

### 4. 배포 스크립트 실행 권한 부여

```bash
chmod +x deploy.sh
```

### 5. 배포 실행

```bash
./deploy.sh
```

배포가 완료되면 다음 주소로 접속:
- **애플리케이션**: `http://YOUR_EC2_PUBLIC_IP`
- **API 문서**: `http://YOUR_EC2_PUBLIC_IP/api/v1/docs`

## 배포 후 작업

### 1. 관리자 계정 생성

웹에서 회원가입 후, EC2에서 다음 명령 실행:

```bash
# PostgreSQL 컨테이너 접속
docker exec -it company_board_db psql -U postgres -d company_board

# 사용자를 관리자로 변경
UPDATE users SET is_admin = true WHERE email = 'your_email@example.com';

# 확인
SELECT id, email, username, is_admin FROM users;

# 종료
\q
```

### 2. 카테고리 생성

브라우저에서 http://YOUR_EC2_PUBLIC_IP/docs 접속:
1. 우측 상단 "Authorize" 클릭
2. 로그인 API로 토큰 받기
3. Bearer 토큰 입력
4. POST /api/v1/categories/ 에서 카테고리 생성

또는 curl 사용:
```bash
# 로그인해서 토큰 받기
TOKEN=$(curl -X POST http://YOUR_EC2_PUBLIC_IP/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your_email@example.com","password":"your_password"}' \
  | jq -r '.access_token')

# 카테고리 생성
curl -X POST http://YOUR_EC2_PUBLIC_IP/api/v1/categories/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"공지사항","description":"중요 공지사항"}'

curl -X POST http://YOUR_EC2_PUBLIC_IP/api/v1/categories/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"자유게시판","description":"자유롭게 글을 작성하세요"}'
```

## 유용한 명령어

### 로그 확인
```bash
# 전체 로그
docker compose -f docker-compose.prod.yml logs -f

# 특정 서비스 로그
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f nginx
```

### 서비스 재시작
```bash
# 전체 재시작
docker compose -f docker-compose.prod.yml restart

# 특정 서비스 재시작
docker compose -f docker-compose.prod.yml restart backend
```

### 서비스 중지/시작
```bash
# 중지
docker compose -f docker-compose.prod.yml down

# 시작
docker compose -f docker-compose.prod.yml up -d
```

### 데이터베이스 백업
```bash
# 백업
docker exec company_board_db pg_dump -U postgres company_board > backup_$(date +%Y%m%d_%H%M%S).sql

# 복원
docker exec -i company_board_db psql -U postgres company_board < backup_20240101_120000.sql
```

## 트러블슈팅

### 1. 메모리 부족 에러
t2.micro는 메모리가 부족할 수 있습니다. 다음 중 하나 선택:
- EC2 인스턴스 타입을 t3.small 이상으로 변경
- Swap 메모리 추가:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. 포트가 이미 사용 중
```bash
# 포트 사용 확인
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :8000

# 프로세스 종료
sudo kill -9 <PID>
```

### 3. Docker 권한 에러
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### 4. Frontend가 Backend에 연결 안됨
- .env 파일의 VITE_API_URL이 올바른지 확인
- 변경 후 반드시 재배포 필요:
```bash
./deploy.sh
```

## 도메인 연결 (선택사항)

### 1. Route 53 또는 다른 DNS 서비스에서 A 레코드 추가
```
Type: A
Name: your-domain.com
Value: YOUR_EC2_PUBLIC_IP
```

### 2. .env 파일 업데이트
```bash
VITE_API_URL=http://your-domain.com
```

### 3. 재배포
```bash
./deploy.sh
```

### 4. SSL 인증서 설정 (선택사항)
Let's Encrypt Certbot 사용:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## 모니터링

### 시스템 리소스 확인
```bash
# CPU, 메모리 사용량
docker stats

# 디스크 사용량
df -h

# Docker 디스크 정리
docker system prune -a
```

## 보안 권장사항

1. **SSH 키 기반 인증 사용** (비밀번호 인증 비활성화)
2. **방화벽 설정**: UFW 사용
```bash
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```
3. **정기적인 보안 업데이트**
```bash
sudo apt update && sudo apt upgrade -y
```
4. **데이터베이스 정기 백업 설정**
5. **.env 파일 권한 설정**
```bash
chmod 600 .env
```

## 성능 최적화

1. **Redis 설정 최적화** (필요시)
2. **PostgreSQL 설정 조정** (필요시)
3. **Nginx 캐싱 설정** (정적 파일)
4. **CloudFront CDN 사용** (선택사항)

---

## 문제 발생 시

1. 로그 확인: `docker compose -f docker-compose.prod.yml logs -f`
2. 서비스 상태: `docker compose -f docker-compose.prod.yml ps`
3. 컨테이너 재시작: `docker compose -f docker-compose.prod.yml restart`

더 자세한 도움이 필요하면 이슈를 등록해주세요.
