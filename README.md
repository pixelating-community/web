# 👾

[![ci](https://github.com/pixelating-community/web/actions/workflows/deploy.yml/badge.svg)](https://github.com/pixelating-community/web/actions/workflows/deploy.yml)

## install

```sh
brew install --cask docker
open -a Docker
COMPOSE_BAKE=true docker compose build --no-cache app
```

or

```sh
brew install orbstack
orb
```

## migrate locally

```sh
docker compose -f production.yml run --rm --build migrations
```

### ci migrate deploy script

```sh
echo "🚀 Pulling images..."
docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-migrations:latest


#echo "🧳 Starting migrations..."
#docker compose -f production.yml up --rm migrations
```

## dev

```sh
# configure .env
docker compose up
docker compose exec app npm lint
docker compose exec app npm run prettier:check
```

## ci

```
.github/workflow/deploy.yml
```

## use

```sh
http://localhost:3000/
```

## destroy

```sh
docker stop $(docker ps -a -q)
docker rm $(docker ps -a -q)
docker system prune -a -f
docker volume prune -f
```
