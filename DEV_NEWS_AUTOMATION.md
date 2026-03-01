# Dev News Auto Publishing

This repository includes a scheduled GitHub Actions workflow:

- File: `.github/workflows/publish-dev-news.yml`
- Trigger: `00:00`, `08:00`, `16:00` UTC (3 runs/day)
- Posts per run: random `3-5` (unless manually overridden)

## Required GitHub Secrets

Set these in `Settings > Secrets and variables > Actions`:

- `IT_NEWS_API_BASE`: public base URL (example: `https://jionc.com`)
- One of:
  - `IT_NEWS_BOT_TOKEN`, or
  - `IT_NEWS_BOT_EMAIL` + `IT_NEWS_BOT_PASSWORD`

Optional:

- `IT_NEWS_CATEGORY_SLUG` (defaults to `dev-news`)
- `IT_NEWS_ALERT_WEBHOOK` (Slack/Discord/webhook URL for failure notifications)

## Manual Execution

Use `Actions > Publish Dev News > Run workflow`:

- `dry_run=true`: parse feeds and print candidate payloads without publishing
- `max_items`: override number of posts for that run

## Local Dry Run

```bash
python .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --dry-run \
  --max-items 5
```

## Quality and Dedupe Guardrails

The publisher now applies additional safety checks:

- Feed source whitelist from `.agents/skills/it-news-scrap-publisher/references/default_feeds.json`
- URL canonicalization dedupe (removes tracking query params like `utm_*`, `gclid`, `fbclid`)
- Title similarity dedupe (`--title-similarity-threshold`, default `0.9`)
- Content quality floor (`--min-content-chars`, default `160`)
- Restricted category safeguard: automation only posts to `dev-news`

Useful flags:

```bash
python .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --dry-run \
  --max-items 3 \
  --title-similarity-threshold 0.88 \
  --min-content-chars 260
```

If you need temporary custom feed URLs:

```bash
python .agents/skills/it-news-scrap-publisher/scripts/publish_it_news.py \
  --dry-run \
  --feed "Custom|https://example.com/rss.xml" \
  --allow-custom-feeds
```
