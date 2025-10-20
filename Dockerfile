FROM public.ecr.aws/docker/library/node:24-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY next.config.mjs ./
COPY tsconfig.json ./
RUN npm install
RUN npm install --cpu=x64 --os=linux --libc=musl sharp

FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_SHARP_PATH=/tmp/node_modules/sharp
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=secret,id=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY \
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(cat /run/secrets/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY) \
    npm run build
RUN npm prune --production

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
USER nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
ENV NODE_ENV=production
CMD ["node", "server.js"]
