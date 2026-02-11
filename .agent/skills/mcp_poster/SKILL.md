---
name: mcp_poster
description: Generates and posts content about the Model Context Protocol (MCP) to the bulletin board.
---

# MCP Poster Skill

This skill allows the Agent to post articles or updates about MCP directly to the application's bulletin board via python script.

## Prerequisites

- Python environment with `backend/requirements.txt` installed.
- Docker containers (postgres) must be running.

## Instructions

1.  **Generate or Prepare Content**:
    -   Create a title and markdown-formatted content for the post.
    -   Example topics: "What is MCP?", "Top 5 MCP Servers", "How to build an MCP Server".

2.  **Create a Temporary JSON File**:
    -   Format the content as a JSON object with `title` and `content` keys.
    -   Save it to a temporary file (e.g., `temp_mcp_post.json` in the root).
    -   Example:
        ```json
        {
          "title": "MCP Server Tutorial",
          "content": "# How to build an MCP Server\n..."
        }
        ```


3.  **Run the Posting Script**:
    -   When running outside the Docker container (e.g. from the terminal), you must override `DATABASE_URL` to point to `localhost`.
    -   To post as a random user instead of the bot, add the `--random-author` flag.
    -   Command:
        ```bash
        export DATABASE_URL=postgresql://postgres:password@localhost:5432/company_board
        cd backend && python3 -m app.create_mcp_post --file ../temp_mcp_post.json --random-author
        ```

4.  **Confirm Success**:
    -   The script will output `Successfully created post: Title (ID: X) by username`.
    -   Clean up the temporary file.

## Example Usage

To post a quick update:

1.  Create `quick_update.json`:
    ```json
    {
      "title": "New MCP Features Released",
      "content": "Check out the latest updates on the official MCP blog!"
    }
    ```
2.  Run:
    ```bash
    export DATABASE_URL=postgresql://postgres:password@localhost:5432/company_board
    cd backend && python3 -m app.create_mcp_post --file ../quick_update.json
    rm ../quick_update.json
    ```
