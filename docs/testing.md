# Testing

Minimal local test checklist.

## Start

`docker compose -f compose.yml up -d --build`

## Validate

1. `docker compose -f compose.yml exec web bun run lint`
2. `docker compose -f compose.yml exec web bun run typecheck`
3. `docker compose -f compose.yml exec web bun run test`
4. `docker compose -f compose.yml exec web bun run build`

## Optional

- Migration check:
  `docker compose -f compose.yml exec web bun run migrate`
- Hurl integration checks:
  `hurl --variables-file hurl/local.vars hurl/topic-upsert.hurl`
  `hurl --variables-file hurl/local.vars hurl/topic-write-access-check.hurl`
