---
name: it-news-scrap-publisher
description: RSS/Atom 피드에서 최신 IT 기사를 수집해 이 프로젝트 커뮤니티의 IT 뉴스(`slug=dev-news`) 게시판에 자동 등록한다. "IT 뉴스를 주기적으로 올려줘", "한국 IT 기사만 스크랩해서 게시해줘", "뉴스 업로드 자동화해줘" 같은 요청에서 사용한다.
---

# IT 뉴스 스크랩/업로드 스킬

## 개요

설정된 피드에서 IT 뉴스를 가져오고, 기존 게시글 링크와 중복을 제거한 뒤, 백엔드 API로 게시글을 생성한다. 게시글 본문은 요약 템플릿이 아니라 기사 본문을 우선 추출해 넣고, 실패 시 요약으로 자동 폴백한다.

## 작업 절차

1. 실행 범위를 먼저 확정한다.
- 생성할 글 수(`--max-items`)와 실제 게시 여부(`--dry-run`)를 정한다.
- API 주소(`--api-base`)와 카테고리 slug(`--category-slug`, 기본 `dev-news`)를 확인한다.
- `--api-base` 기본값은 `IT_NEWS_API_BASE` 또는 루트 `.env`/`.env.production`의 `VITE_API_URL`을 자동 사용한다.

2. 항상 드라이런부터 실행한다.
- `--dry-run`으로 제목/링크/요약을 먼저 점검한다.
- 네트워크 없이 파서만 확인할 때는 `--no-api`를 함께 쓴다.
- 기사 페이지 본문 추출을 잠시 끄려면 `--no-article-fetch`를 사용한다.

3. 인증 후 게시한다.
- 가능하면 `--token`(또는 `IT_NEWS_BOT_TOKEN`)을 사용한다.
- 토큰이 없으면 `--email`/`--password`로 로그인 토큰을 발급받아 게시한다.

4. 결과를 검증한다.
- 요약 로그의 `created`, `skipped`, `failed` 수치를 확인한다.
- 필요하면 UI 또는 `GET /api/v1/posts/?category_id=<id>`로 실제 반영 여부를 검증한다.

## 실행 예시

프로젝트 루트에서 실행한다.

```bash
python .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --dry-run \
  --max-items 5
```

토큰으로 실제 게시:

```bash
IT_NEWS_BOT_TOKEN="..." \
python .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --max-items 5
```

이메일/비밀번호 로그인 후 게시:

```bash
python .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --email bot@example.com \
  --password 'password' \
  --max-items 3
```

커스텀 피드 사용:

```bash
python .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --dry-run \
  --feed "ZDNet Korea|https://www.zdnet.co.kr/news/news.xml" \
  --feed "IT Chosun|https://it.chosun.com/rss.xml"
```

오프라인 파서 점검:

```bash
python .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --dry-run \
  --no-api \
  --feed .agents/skills/it-news-scrap-publisher/references/sample_feed.xml
```

외국 기사도 포함하고 싶을 때:

```bash
python .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --dry-run \
  --allow-global
```

본문 추출 없이 요약 폴백만 사용하고 싶을 때:

```bash
python .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --dry-run \
  --no-article-fetch
```

## Docker Compose 배포 서버에서 사용

1. 서버에서 프로젝트 루트(`antigravity`)로 이동한다.
2. `docker compose -f docker-compose.prod.yml up -d`로 서비스가 올라와 있는지 확인한다.
3. 루트 `.env`에 서비스 주소가 맞는지 확인한다.
- 예시: `VITE_API_URL=http://3.89.59.227`
4. 스크립트를 실행한다. (기본적으로 `.env`의 `VITE_API_URL`을 자동 사용)

```bash
python3 .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --dry-run \
  --max-items 5
```

5. 실제 게시는 토큰 또는 계정으로 실행한다.

```bash
IT_NEWS_BOT_TOKEN="..." \
python3 .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --max-items 5
```

6. 필요하면 API 주소를 명시적으로 덮어쓴다.

```bash
python3 .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --api-base "http://3.89.59.227" \
  --dry-run
```

## 파일 구성

- `scripts/publish_it_news.py`: 피드 수집, 한국 기사 필터링, 중복 제거, 게시글 생성
- `references/default_feeds.json`: 기본 한국 IT 뉴스 피드 목록
- `references/sample_feed.xml`: 오프라인 테스트용 샘플 피드

## 운영 원칙

- 본문에 원문 링크와 출처를 반드시 포함한다.
- `dev-news` 카테고리 기존 글과 링크 중복을 피한다.
- 본문은 기사 핵심 단락 발췌를 우선 사용하고, 추출 실패 시 요약으로 대체한다.

## 실패 대응

- 일부 항목만 실패할 때는 에러 로그의 `first_error`와 `title_len/content_len`을 확인한다.
- 스크립트는 게시 실패 시 자동으로 짧은 폴백 본문으로 1회 재시도한다.
- 계속 실패하면 `--max-items 1 --dry-run`으로 개별 항목 payload를 점검한 뒤 다시 실행한다.
