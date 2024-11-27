#!/bin/sh
set -e

IMAGE_NAME="registry.digitalocean.com/pixelating/web"
GIT_HASH=$(git rev-parse --short HEAD)
if [ -n "$(git status --porcelain)" ]; then
    GIT_HASH="${GIT_HASH}-dirty"
fi

#docker compose build --no-cache app
#doctl registry login --context pixelating-community
#yes | doctl registry garbage-collection start --include-untagged-manifests --context pixelating-community

docker tag web "${IMAGE_NAME}"
docker push "${IMAGE_NAME}:${GIT_HASH}"
