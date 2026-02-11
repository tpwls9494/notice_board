---
name: mcp_engager
description: Automatically likes and comments on recent posts in the bulletin board.
---

# MCP Engager Skill

This skill allows the Agent to automatically interact with recent posts on the bulletin board by adding likes and comments.

## Prerequisites

- Python environment with `backend/requirements.txt` installed.
- Database access configured (same as `mcp_poster`).

## Instructions

1.  **Configure Engagement Type**:
    -   Identify if you want to `like`, `comment`, or do `both`.

2.  **Run the Engagement Script**:
    -   Execute the python module `app.engage_posts` from the `backend` directory.
    -   When running outside the Docker container (e.g. from the terminal), you must override `DATABASE_URL` to point to `localhost`.
    -   Command:
        ```bash
        export DATABASE_URL=postgresql://postgres:password@localhost:5432/company_board
        cd backend && python3 -m app.engage_posts --type both
        ```

3.  **Confirm Success**:
    -   The script will output which posts were liked or commented on.

## Example Usage

To add likes and comments to recent posts:

```bash
export DATABASE_URL=postgresql://postgres:password@localhost:5432/company_board
cd backend && python3 -m app.engage_posts --type both
```
