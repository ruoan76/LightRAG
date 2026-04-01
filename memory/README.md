# Agent Memory

This directory is used by the **memsearch** agent memory feature. Any `.md` files here are indexed and searched at query time; relevant snippets are appended to the RAG context as "Agent Memory (relevant past context)".

## How to use

1. Add markdown files (e.g. meeting notes, decisions, preferences).
2. Restart the server or call `POST /memory/index` to re-index after changes.
3. Queries will automatically include relevant memory when `MEMORY_ENABLED=true`.

## Example

- **Decision**: We use Redis for caching.
- **Team**: Alice (frontend), Bob (backend).
