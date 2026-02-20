# Vault setup for GitHub Actions deploy

This repo's deploy workflow (`.github/workflows/ci.yml`) supports Vault via GitHub OIDC JWT.

## 1) Enable JWT auth in Vault

```bash
vault auth enable jwt

vault write auth/jwt/config \
  bound_issuer="https://token.actions.githubusercontent.com" \
  oidc_discovery_url="https://token.actions.githubusercontent.com"
```

## 2) Create least-privilege policy

This example grants read-only access to one KV v2 secret.

```bash
cat > /tmp/pixelating-web-ci.hcl <<'EOF'
path "secret/data/pixelating/web/deploy" {
  capabilities = ["read"]
}
EOF

vault policy write pixelating-web-ci /tmp/pixelating-web-ci.hcl
```

## 3) Create JWT role for this repo/branch

Update `pixelating-community/web` if your repo differs.

```bash
vault write auth/jwt/role/pixelating-web-ci \
  role_type="jwt" \
  bound_audiences="https://github.com/pixelating-community" \
  user_claim="sub" \
  bound_subject="repo:pixelating-community/web:ref:refs/heads/main" \
  policies="pixelating-web-ci" \
  ttl="15m"
```

## 4) Write deploy secret values

Expected keys:
- `host`
- `username`
- `ssh_private_key`
- `ssh_port` (optional)
- `app_env_content` (optional; full `.env` text)

```bash
vault kv put secret/pixelating/web/deploy \
  host="128.140.104.6" \
  username="root" \
  ssh_private_key="$(cat ~/.ssh/id_ed25519)" \
  ssh_port="22" \
  app_env_content="$(cat /path/to/production.env)"
```

## 5) Configure GitHub repository variables

Set:
- `VAULT_ADDR`
- `VAULT_ROLE` = `pixelating-web-ci`
- `VAULT_SECRET_PATH` = `secret/data/pixelating/web/deploy`

Optional:
- `VAULT_AUTH_PATH` (default `jwt`)
- `VAULT_NAMESPACE` (HCP Vault uses `admin`)
- `VAULT_GITHUB_AUDIENCE` (default `https://github.com/<repo-owner>`)
- `ALLOW_EMPTY_APP_ENV_CONTENT` (set `true` to allow missing `app_env_content`)
- `REQUIRE_VAULT_SECRETS` (set `true` to fail when required values come from GitHub fallback)

## 6) Trigger deploy

Run workflow `ci` manually (`workflow_dispatch`) or push to `main`.
