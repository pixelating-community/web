#!/bin/sh
set -e

export POSTGRES_USER=$(cat /run/secrets/POSTGRES_USER)
export POSTGRES_PASSWORD=$(cat /run/secrets/POSTGRES_PASSWORD)
export POSTGRES_DB=$(cat /run/secrets/POSTGRES_DB)
export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(cat /run/secrets/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY)
export BUCKET_NAME=$(cat /run/secrets/BUCKET_NAME)
export BUCKET_REGION=$(cat /run/secrets/BUCKET_REGION)
export BUCKET_URL=$(cat /run/secrets/BUCKET_URL)
export SPACES_KEY=$(cat /run/secrets/SPACES_KEY)
export SPACES_SECRET=$(cat /run/secrets/SPACES_SECRET)
export EL_KEY=$(cat /run/secrets/EL_KEY)
export NEXT_PUBLIC_URL=$(cat /run/secrets/NEXT_PUBLIC_URL)
export NEXT_PUBLIC_CDN_URL=$(cat /run/secrets/NEXT_PUBLIC_CDN_URL)
export NEXT_PUBLIC_PIXEL_SIZE=$(cat /run/secrets/NEXT_PUBLIC_PIXEL_SIZE)
export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$(cat /run/secrets/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
export STRIPE_SECRET_KEY=$(cat /run/secrets/STRIPE_SECRET_KEY)
export STRIPE_WEBHOOK_SECRET=$(cat /run/secrets/STRIPE_WEBHOOK_SECRET)

exec "$@"
