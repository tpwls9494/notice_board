---
name: mcp_engager
description: 게시판의 최근 글에 자동으로 좋아요와 댓글을 작성합니다.
---

# MCP 게시글 반응 스킬

이 스킬은 게시판의 최근 글에 자동으로 좋아요와 댓글을 추가하여 활발한 커뮤니티 분위기를 조성합니다.

## 사전 요구사항

- Python 환경에 `backend/requirements.txt` 설치 필요
- 데이터베이스 접근 설정 완료 (`mcp_poster`와 동일)

## 주요 기능

- **한글 댓글 지원**: 모든 댓글이 자연스러운 한글로 작성됨
- **현재 시각 자동 설정**: 댓글 작성 시 현재 시각(`datetime.now()`)이 자동으로 설정됨
- **실제 영어 사용자명 생성**: "codingking99", "devmasterx", "john_kim2024", "visitor123" 등 실제 사용자 같은 영어 이름으로 생성
- **다양한 한글 댓글**: 25개 이상의 자연스러운 한글 댓글 중 랜덤 선택

## 댓글 예시

스크립트가 사용하는 한글 댓글 예시:
- "정말 유용한 정보네요! 감사합니다."
- "이 주제에 대해 더 알아보고 싶었는데 딱이네요."
- "MCP가 앞으로 어떻게 발전할지 기대됩니다."
- "좋은 글 잘 읽었습니다."
- "완전 꿀팁이네요 ㅋㅋ"
- "스크랩 해갑니다~"
- "유익한 정보 공유해주셔서 감사합니다!"
- "이런 걸 찾고 있었어요."
- "도움이 많이 되었습니다."
- "설명이 정말 친절하네요."
- "자세한 가이드 감사드립니다 👍"
- "예제 코드도 있을까요?"
- "실전에서 바로 써먹을 수 있겠어요."
- 그 외 다수

## 사용 방법

1.  **반응 유형 선택**:
    -   `like`: 좋아요만 추가
    -   `comment`: 댓글만 추가
    -   `both`: 좋아요와 댓글 모두 추가

2.  **스크립트 실행**:
    -   Docker 컨테이너 외부에서 실행 시 `DATABASE_URL`을 localhost로 설정 필요
    -   `backend` 디렉토리에서 `app.engage_posts` 모듈 실행
    -   명령어:
        ```bash
        export DATABASE_URL=postgresql://postgres:password@localhost:5432/company_board
        cd backend && python3 -m app.engage_posts --type both
        ```

3.  **결과 확인**:
    -   스크립트가 어떤 글에 좋아요/댓글을 달았는지 출력

## 예시

최근 글에 좋아요와 댓글 추가:

```bash
export DATABASE_URL=postgresql://postgres:password@localhost:5432/company_board
cd backend && python3 -m app.engage_posts --type both
```

좋아요만 추가:

```bash
export DATABASE_URL=postgresql://postgres:password@localhost:5432/company_board
cd backend && python3 -m app.engage_posts --type like
```

댓글만 추가:

```bash
export DATABASE_URL=postgresql://postgres:password@localhost:5432/company_board
cd backend && python3 -m app.engage_posts --type comment
```

## 작동 방식

- 최근 10개 글을 확인
- 각 글마다 50% 확률로 반응 (스팸 방지)
- 좋아요: 70% 확률로 추가 (반응하는 경우)
- 댓글: 60% 확률로 추가 (반응하는 경우)
- 각 반응마다 새로운 랜덤 사용자 생성

## 참고사항

- 댓글 작성 시각은 **현재 시각**이 자동으로 설정됩니다
- 모든 댓글은 **자연스러운 한글**로 작성됩니다
- 매 실행마다 새로운 실제 사용자 같은 영어 계정들이 생성됩니다
- 사용자명 예시: "codingking99", "visitor123", "john_kim2024", "techiedev", "fullstacker567" 등
