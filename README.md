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

## Audio Cleanup Worker (FFmpeg + ARNNDN)

1. Place a model file at `models/cb.rnnn` (or set `ARNNDN_MODEL_PATH`).
2. Spin up worker container locally:
   `docker compose -f compose.yml --profile worker up -d --build ffmpeg-worker`
3. Run one cleanup job:
   `docker compose -f compose.yml --profile worker exec ffmpeg-worker bun run audio:worker --input-key <r2-input-key> --mix 0.8 --model cb.rnnn`

Optional second input for two-track mix:
`--input-key-2 <r2-second-key>`

Extended runbooks and private operational details should live in local/private docs, not in this file.
