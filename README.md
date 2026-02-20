# web

Quickstart only.

1. Start local stack:
   `docker compose -f compose.yml up --build`
2. Run lint:
   `docker compose -f compose.yml exec web bun run lint`
3. Run typecheck:
   `docker compose -f compose.yml exec web bun run typecheck`
4. Run tests:
   `docker compose -f compose.yml exec web bun run test`
5. Run build:
   `docker compose -f compose.yml exec web bun run build`

Extended runbooks and private operational details should live in local/private docs, not in this file.
