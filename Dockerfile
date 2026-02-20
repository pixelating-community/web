FROM oven/bun:1.3.11 AS base
ARG REQUIRED_BUN_VERSION=1.3.11
WORKDIR /app
RUN test "$(bun --version)" = "$REQUIRED_BUN_VERSION"
RUN apt-get update \
  && apt-get install -y --no-install-recommends cron ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["bun", "run", "dev"]

FROM deps AS ffmpeg-worker
COPY . .
CMD ["sleep", "infinity"]

FROM deps AS build
COPY . .
RUN bun run build

FROM base AS prod
WORKDIR /app
COPY --from=build /app .
EXPOSE 3000
CMD ["sh", "scripts/run-web.sh", "prod"]
