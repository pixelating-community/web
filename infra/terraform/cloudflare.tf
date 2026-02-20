# cloudflare.tf - Free tier configuration

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.49"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "enable_cloudflare" {
  type    = bool
  default = true
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "zone_id" {
  type = string
}

variable "account_id" {
  type = string
}

variable "domain" {
  type    = string
  default = "pixelat.ing"
}

variable "r2_wav_bucket" {
  type    = string
  default = "audio"
}

variable "configure_cloudflare_https_settings" {
  type    = bool
  default = true
}

resource "cloudflare_zone_setting" "tls_1_3" {
  count      = var.enable_cloudflare && var.configure_cloudflare_https_settings ? 1 : 0
  zone_id    = var.zone_id
  setting_id = "tls_1_3"
  value      = "on"
}

resource "cloudflare_zone_setting" "automatic_https_rewrites" {
  count      = var.enable_cloudflare && var.configure_cloudflare_https_settings ? 1 : 0
  zone_id    = var.zone_id
  setting_id = "automatic_https_rewrites"
  value      = "on"
}

resource "cloudflare_zone_setting" "ssl" {
  count      = var.enable_cloudflare && var.configure_cloudflare_https_settings && var.create_cloudflare_origin_ca_certificate ? 1 : 0
  zone_id    = var.zone_id
  setting_id = "ssl"
  value      = "strict"
}

resource "cloudflare_r2_bucket" "audio" {
  count      = var.enable_cloudflare ? 1 : 0
  account_id = var.account_id
  name       = var.r2_wav_bucket
}

resource "cloudflare_r2_custom_domain" "audio" {
  count       = var.enable_cloudflare ? 1 : 0
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.audio[0].name
  zone_id     = var.zone_id
  domain      = "obj.${var.domain}"
  enabled     = true
}

resource "cloudflare_r2_bucket_cors" "audio" {
  count       = var.enable_cloudflare ? 1 : 0
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.audio[0].name

  rules = [
    {
      allowed = {
        origins = ["*"]
        methods = ["GET", "HEAD", "PUT", "POST"]
        headers = ["Content-Type", "Authorization", "Range", "Origin"]
      }
      expose_headers  = ["Content-Length", "Content-Range", "Accept-Ranges", "ETag", "Content-Type"]
      max_age_seconds = 86400
    },
  ]
}

moved {
  from = cloudflare_r2_bucket.wav
  to   = cloudflare_r2_bucket.audio
}

moved {
  from = cloudflare_r2_custom_domain.wav
  to   = cloudflare_r2_custom_domain.audio
}

moved {
  from = cloudflare_r2_bucket_cors.wav
  to   = cloudflare_r2_bucket_cors.audio
}

# WAF Custom Rules (5 max on free tier)
resource "cloudflare_ruleset" "waf_custom" {
  count       = var.enable_cloudflare ? 1 : 0
  zone_id     = var.zone_id
  name        = "Custom WAF rules"
  description = "Free tier firewall rules"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [
    {
      action      = "block"
      expression  = "(cf.client.bot) and (http.request.uri.path contains \"/api/\") and (http.request.uri.path ne \"/api/s/h\")"
      description = "Block bots on API"
      enabled     = true
    },
    {
      action      = "block"
      expression  = "(http.user_agent eq \"\") and (http.request.uri.path contains \"/api/\")"
      description = "Block empty UA on API"
      enabled     = true
    },
    {
      action      = "block"
      expression  = "(http.request.uri.query contains \"<script\") or (http.request.uri.query contains \"SELECT \") or (http.request.uri.query contains \"UNION \")"
      description = "Block SQLi/XSS attempts"
      enabled     = true
    },
    {
      action      = "managed_challenge"
      expression  = "((starts_with(http.request.uri.path, \"/api/c\")) or (starts_with(http.request.uri.path, \"/api/t\"))) and (ip.geoip.country in {\"RU\" \"CN\" \"KP\" \"IR\"})"
      description = "Challenge admin API from high-risk countries"
      enabled     = true
    },
    {
      action      = "block"
      expression  = format("(lower(http.host) ne \"%s\") and (not ends_with(lower(http.host), \".%s\"))", lower(var.domain), lower(var.domain))
      description = "Block requests outside managed domain"
      enabled     = true
    },
  ]
}

# Cache Rules (2 max on free tier)
resource "cloudflare_ruleset" "cache" {
  count       = var.enable_cloudflare ? 1 : 0
  zone_id     = var.zone_id
  name        = "Cache rules"
  description = "Free tier cache config"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  rules = [
    {
      action = "set_cache_settings"
      action_parameters = {
        cache = true
        edge_ttl = {
          mode    = "override_origin"
          default = 31536000
        }
        browser_ttl = {
          mode    = "override_origin"
          default = 31536000
        }
      }
      expression  = "starts_with(http.request.uri.path, \"/_next/static\")"
      description = "Cache static assets 1 year"
      enabled     = true
    },
    {
      action = "set_cache_settings"
      action_parameters = {
        cache = false
      }
      expression  = "starts_with(http.request.uri.path, \"/api/\")"
      description = "Bypass API cache"
      enabled     = true
    },
  ]
}
