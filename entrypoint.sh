#!/bin/sh
set -e

export POSTGRES_USER=$(cat /run/secrets/POSTGRES_USER)
export POSTGRES_PASSWORD=$(cat /run/secrets/POSTGRES_PASSWORD)
export POSTGRES_DB=$(cat /run/secrets/POSTGRES_DB)
export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(cat /run/secrets/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY)
export EL_KEY=$(cat /run/secrets/EL_KEY)
export NEXT_PUBLIC_URL=$(cat /run/secrets/NEXT_PUBLIC_URL)
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$(cat /run/secrets/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
export STRIPE_SECRET_KEY=$(cat /run/secrets/STRIPE_SECRET_KEY)
export STRIPE_WEBHOOK_SECRET=$(cat /run/secrets/STRIPE_WEBHOOK_SECRET)
export REFLECTION_ACCESS_SECRET=$(cat /run/secrets/REFLECTION_ACCESS_SECRET)
export SSE_BROADCAST_KEY=$(cat /run/secrets/SSE_BROADCAST_KEY)

exec "$@"
