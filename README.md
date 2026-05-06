# web

```sh
docker compose -f compose.yml up --build
docker compose -f compose.yml exec web bun run lint
docker compose -f compose.yml exec web bun run typecheck
docker compose -f compose.yml exec web bun run test
docker compose -f compose.yml exec web bun run build
```
