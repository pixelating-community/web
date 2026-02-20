FROM oven/bun:1.3.9 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["bun", "run", "dev"]

FROM deps AS build
COPY . .
RUN bun run build

FROM base AS prod
WORKDIR /app
COPY --from=build /app .
EXPOSE 3000
CMD ["bun", "run", "start"]
