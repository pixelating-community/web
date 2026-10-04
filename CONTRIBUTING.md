# Contributing

## Development environment

- Use Docker Compose for local development.
- Run all app commands in the `web` container.

Start services:

`docker compose -f compose.yml up -d --build`

## Common commands

- Lint: `docker compose -f compose.yml exec web bun run lint`
- Lint autofix: `docker compose -f compose.yml exec web bun run lint:fix`
- Typecheck: `docker compose -f compose.yml exec web bun run typecheck`
- Tests: `docker compose -f compose.yml exec web bun run test`
- Build: `docker compose -f compose.yml exec web bun run build`
- Migrations: `docker compose -f compose.yml exec web bun run migrate`
- Audio worker (start): `docker compose -f compose.yml --profile worker up -d --build ffmpeg-worker`
- Audio worker (run): `docker compose -f compose.yml --profile worker exec ffmpeg-worker bun run audio:worker --input-key <r2-key>`

## CI and production releases

The `ci` workflow validates pull requests targeting `main`, including documentation-only
and fork PRs. Fork PR runs are subject to GitHub's approval settings. Validation builds
and starts the Docker services, then runs lint, typecheck, tests, and the application
build in the `web` container.

Pushes to `main` matching the existing path filters in `.github/workflows/ci.yml` and
manual runs on `main` publish images and deploy to production after successful
validation. PR runs and manual runs on other branches or tags validate only.
The job dependency chain is `validate → build → deploy`, so failed validation prevents
image publishing and deployment.

These checks report PR failures; this workflow does not make them mandatory merge
requirements or change repository merge settings.

## Package management

- Runtime/package manager is Bun.
- Do not install dependencies on host for app changes.
- Add/remove deps in-container, for example:
  - `docker compose -f compose.yml exec web bun add <pkg>`
  - `docker compose -f compose.yml exec web bun add -d <pkg>`
- Commit `package.json` and `bun.lock` together.

## Linting and formatting

- Linter: `oxlint` via `bun run lint`
- Optional formatter: `oxfmt`

Manual formatter examples:

- Check:
  `docker compose -f compose.yml exec web bunx oxfmt --check --no-error-on-unmatched-pattern 'src/**/*.{ts,tsx,js,jsx}' 'scripts/**/*.{ts,tsx,js,jsx}' 'tests/**/*.{ts,tsx,js,jsx}' '*.config.{ts,js,mjs,cjs}'`
- Write:
  `docker compose -f compose.yml exec web bunx oxfmt --write --no-error-on-unmatched-pattern 'src/**/*.{ts,tsx,js,jsx}' 'scripts/**/*.{ts,tsx,js,jsx}' 'tests/**/*.{ts,tsx,js,jsx}' '*.config.{ts,js,mjs,cjs}'`

## Notes

- This repo is TanStack Start + Vite, not Next.js.
- API object contract uses `/api/obj` only.
- `samples` and `edits` are excluded from schema migration.

## More docs

- Testing: `docs/testing.md`
- Infra: `infra/terraform`
- Vault: `infra/vault/README.md`
- AI/coding-agent instructions: `AGENTS.md`
