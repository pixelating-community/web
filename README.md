# 👾

[![ci](https://github.com/pixelating-community/web/actions/workflows/deploy.yml/badge.svg)](https://github.com/pixelating-community/web/actions/workflows/deploy.yml)

## install

```sh
brew install --cask docker
open -a Docker
docker compose build --no-cache app
```

## migrate

```sh
docker compose -f production.yml up --build migrations
```

## dev

```sh
# configure .env
docker compose up
docker compose exec app npm lint
docker compose exec app npm run prettier:check
```

## prod

```sh
docker compose -f production.yml up
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
