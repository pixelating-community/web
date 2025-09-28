# 👾

[![ci](https://github.com/pixelating-community/web/actions/workflows/ci.yml/badge.svg)](https://github.com/pixelating-community/web/actions/workflows/ci.yml)

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


## dev

```sh
# configure .env
npm install typescript --save-dev
npm install biome --save-dev
docker compose up
docker compose exec app npm lint
docker compose exec app npm lint:fix
docker compose exec app npm run format
```

## dev migrate

```sh
docker exec -i app sh -c "npm install --no-save postgres && node /app/migrations/migrate.mjs"
```


## ci

```
.github/workflow/deploy.yml
```

```
.github/workflow/migrate.yml
```

## use

```sh
http://localhost:3000/
```

## destroy

```sh
docker compose down -v --rmi all --remove-orphans 2>/dev/null || true && docker stop $(docker ps -aq) 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker system prune -a --volumes -f
```
