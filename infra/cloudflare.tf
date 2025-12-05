# cloudflare.tf - Free tier configuration

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "zone_id" {
  type = string
}

variable "domain" {
  type    = string
  default = "pixelat.ing"
}

# Zone Settings (all free)
resource "cloudflare_zone_settings_override" "settings" {
  zone_id = var.zone_id

  settings {
    ssl                      = "strict"
    always_use_https         = "on"
    min_tls_version          = "1.2"
    tls_1_3                  = "on"
    automatic_https_rewrites = "on"
    security_level           = "medium"
    challenge_ttl            = 1800
    browser_check            = "on"
    brotli                   = "on"
    early_hints              = "on"
    rocket_loader            = "off"
    # minify is not available on free tier
    # http2 is read-only and cannot be set via API
    http3               = "on"
    websockets          = "on"
    ip_geolocation      = "on"
    email_obfuscation   = "on"
    server_side_exclude = "on"
    hotlink_protection  = "on"
  }
}

# WAF Custom Rules (5 max on free tier)
resource "cloudflare_ruleset" "waf_custom" {
  zone_id     = var.zone_id
  name        = "Custom WAF rules"
  description = "Free tier firewall rules"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # 1. Block bad bots on API
  rules {
    action      = "block"
    expression  = "(cf.client.bot) and (http.request.uri.path contains \"/api/\") and (http.request.uri.path ne \"/api/s/h\")"
    description = "Block bots on API"
    enabled     = true
  }

  # 2. Block empty user agents on API
  rules {
    action      = "block"
    expression  = "(http.user_agent eq \"\") and (http.request.uri.path contains \"/api/\")"
    description = "Block empty UA on API"
    enabled     = true
  }

  # 3. Block suspicious patterns
  rules {
    action      = "block"
    expression  = "(http.request.uri.query contains \"<script\") or (http.request.uri.query contains \"SELECT \") or (http.request.uri.query contains \"UNION \")"
    description = "Block SQLi/XSS attempts"
    enabled     = true
  }

  # 4. Challenge high-threat countries on admin API (free tier: no regex matches operator)
  rules {
    action      = "managed_challenge"
    expression  = "((starts_with(http.request.uri.path, \"/api/c\")) or (starts_with(http.request.uri.path, \"/api/t\"))) and (ip.geoip.country in {\"RU\" \"CN\" \"KP\" \"IR\"})"
    description = "Challenge admin API from high-risk countries"
    enabled     = true
  }

  # 5. Block direct IP access (no Host header match)
  rules {
    action      = "block"
    expression  = "(http.host ne \"pixelat.ing\") and (http.host ne \"www.pixelat.ing\")"
    description = "Block non-domain requests"
    enabled     = true
  }
}

# Cache Rules (2 max on free tier)
resource "cloudflare_ruleset" "cache" {
  zone_id     = var.zone_id
  name        = "Cache rules"
  description = "Free tier cache config"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  # 1. Cache Next.js static assets
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 31536000
      }
      browser_ttl {
        mode    = "override_origin"
        default = 31536000
      }
    }
    expression  = "starts_with(http.request.uri.path, \"/_next/static\")"
    description = "Cache static assets 1 year"
    enabled     = true
  }

  # 2. Bypass cache for API
  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = false
    }
    expression  = "starts_with(http.request.uri.path, \"/api/\")"
    description = "Bypass API cache"
    enabled     = true
  }
}
