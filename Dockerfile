FROM oven/bun:1.3.10 AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["bun", "run", "dev"]

FROM deps AS ffmpeg-worker
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
COPY . .
CMD ["sleep", "infinity"]

FROM deps AS build
COPY . .
RUN bun run build

FROM base AS prod
WORKDIR /app
COPY --from=build /app .
EXPOSE 3000
CMD ["bun", "run", "start"]
