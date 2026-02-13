---
name: mcp_poster
description: MCP(Model Context Protocol) 관련 글을 게시판에 자동으로 작성합니다.
---

# MCP 게시글 작성 스킬

이 스킬은 MCP 관련 글이나 업데이트를 Python 스크립트를 통해 게시판에 자동으로 작성합니다.

## 사전 요구사항

- Python 환경에 `backend/requirements.txt` 설치 필요
- Docker 컨테이너(postgres)가 실행 중이어야 함

## 주요 기능

- **한글 콘텐츠 지원**: 제목과 내용을 한글로 작성
- **현재 시각 자동 설정**: 글 작성 시 현재 시각(`datetime.now()`)이 자동으로 설정됨
- **실제 영어 사용자명 생성**: `--random-author` 플래그 사용 시 "codingking99", "developerx", "john_kim2024" 등 실제 사용자 같은 영어 이름으로 생성

## 사용 방법

1.  **콘텐츠 작성**:
    -   한글로 제목과 마크다운 형식의 내용을 작성
    -   예시 주제: "MCP란 무엇인가?", "인기 MCP 서버 TOP 5", "MCP 서버 만들기 가이드"

2.  **임시 JSON 파일 생성**:
    -   `title`과 `content` 키를 가진 JSON 객체로 포맷
    -   루트 디렉토리에 임시 파일로 저장 (예: `temp_mcp_post.json`)
    -   예시:
        ```json
        {
          "title": "MCP 서버 만들기 튜토리얼",
          "content": "# MCP 서버를 만드는 방법\n\n이번 글에서는..."
        }
        ```

3.  **스크립트 실행**:
    -   Docker 컨테이너 외부에서 실행 시 `DATABASE_URL`을 localhost로 설정 필요
    -   봇 대신 랜덤 유저로 작성하려면 `--random-author` 플래그 추가
    -   명령어:
        ```bash
        export DATABASE_URL=postgresql://postgres:password@localhost:5432/company_board
        cd backend && python3 -m app.create_mcp_post --file ../temp_mcp_post.json --random-author
        ```

4.  **결과 확인**:
    -   스크립트가 `Successfully created post: 제목 (ID: X) by 사용자명` 출력
    -   임시 파일 정리

## 예시

한글 게시글 작성:

1.  `quick_update.json` 생성:
    ```json
    {
      "title": "새로운 MCP 기능 출시",
      "content": "최신 업데이트는 공식 MCP 블로그에서 확인하세요!"
    }
    ```
2.  실행:
    ```bash
    export DATABASE_URL=postgresql://postgres:password@localhost:5432/company_board
    cd backend && python3 -m app.create_mcp_post --file ../quick_update.json --random-author
    rm ../quick_update.json
    ```

## 참고사항

- 글 작성 시각은 **현재 시각**이 자동으로 설정됩니다
- `--random-author` 사용 시 매번 새로운 실제 사용자 같은 영어 계정이 생성됩니다
- 사용자명 예시: "codingking99", "devmasterx", "john_kim2024", "techie123", "fullstackerpro" 등
- **게시글 내용은 한글로 작성**하여 자연스러운 커뮤니티 분위기를 만듭니다
