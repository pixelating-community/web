FROM node:22.3.0-alpine3.19 AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install postgres

FROM base AS builder
WORKDIR /app
COPY migrations/migrate.mjs ./
COPY --from=deps /app/node_modules ./node_modules
