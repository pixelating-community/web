# 👾

[![ci](https://github.com/pixelating-community/web/actions/workflows/ci.yml/badge.svg)](https://github.com/pixelating-community/web/actions/workflows/ci.yml)

## prerequisites

```sh
brew install orbstack
```

## dev (docker compose)

```sh
cp .env.sample .env
# set POSTGRES_PASSWORD (and any app vars you need) in .env
orb
docker compose up --build
```

app: http://localhost:3000
node inspector: localhost:9229

## lint

```sh
docker compose exec app npm run lint
```

## format

```sh
docker compose exec app npm run format
```

```sh
docker compose run --rm app npm install
docker compose build app
docker compose up -d
```

## dev migrate

```sh
docker compose exec app npm install --no-save postgres && node /app/migrations/migrate.mjs
```

## ci

```sh
.github/workflows/ci.yml
```

```sh
.github/workflows/migrate.yml
```

## destroy

```sh
docker compose down -v --rmi all --remove-orphans 2>/dev/null || true && docker system prune -a --volumes -f
```
