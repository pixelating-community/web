# Additive PXL8 infrastructure. Disabled by default so the current domain and
# production stack remain untouched until the new site is ready for cutover.

variable "enable_pxl8" {
  type    = bool
  default = false
}

variable "pxl8_zone_id" {
  type    = string
  default = ""
}

variable "pxl8_domain" {
  type    = string
  default = "pxl8.ing"
}

variable "pxl8_r2_bucket" {
  type    = string
  default = "pxl8-media"
}

variable "pxl8_origin_ipv4" {
  type        = string
  default     = ""
  description = "Existing Hetzner server IPv4 address used by the PXL8 DNS records."
}

variable "pxl8_create_dns" {
  type    = bool
  default = false
}

variable "pxl8_configure_https_settings" {
  type    = bool
  default = true
}

variable "pxl8_create_origin_ca_certificate" {
  type    = bool
  default = true
}

variable "pxl8_origin_ca_requested_validity" {
  type    = number
  default = 5475
}

locals {
  pxl8_enabled = var.enable_cloudflare && var.enable_pxl8
  pxl8_origins = [
    "https://${var.pxl8_domain}",
    "https://www.${var.pxl8_domain}",
    "https://we.${var.pxl8_domain}",
  ]
}

resource "cloudflare_zone_setting" "pxl8_tls_1_3" {
  count      = local.pxl8_enabled && var.pxl8_configure_https_settings ? 1 : 0
  zone_id    = var.pxl8_zone_id
  setting_id = "tls_1_3"
  value      = "on"
}

resource "cloudflare_zone_setting" "pxl8_automatic_https_rewrites" {
  count      = local.pxl8_enabled && var.pxl8_configure_https_settings ? 1 : 0
  zone_id    = var.pxl8_zone_id
  setting_id = "automatic_https_rewrites"
  value      = "on"
}

resource "cloudflare_zone_setting" "pxl8_ssl" {
  count      = local.pxl8_enabled && var.pxl8_configure_https_settings && var.pxl8_create_origin_ca_certificate ? 1 : 0
  zone_id    = var.pxl8_zone_id
  setting_id = "ssl"
  value      = "strict"
}

resource "cloudflare_r2_bucket" "pxl8_media" {
  count      = local.pxl8_enabled ? 1 : 0
  account_id = var.account_id
  name       = var.pxl8_r2_bucket
}

resource "cloudflare_r2_custom_domain" "pxl8_media" {
  count       = local.pxl8_enabled ? 1 : 0
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.pxl8_media[0].name
  zone_id     = var.pxl8_zone_id
  domain      = "obj.${var.pxl8_domain}"
  enabled     = true
}

resource "cloudflare_r2_bucket_cors" "pxl8_media" {
  count       = local.pxl8_enabled ? 1 : 0
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.pxl8_media[0].name

  rules = [
    {
      allowed = {
        origins = local.pxl8_origins
        methods = ["GET", "HEAD", "PUT", "POST"]
        headers = ["Content-Type", "Authorization", "Range", "Origin"]
      }
      expose_headers  = ["Content-Length", "Content-Range", "Accept-Ranges", "ETag", "Content-Type"]
      max_age_seconds = 86400
    },
  ]
}

resource "cloudflare_ruleset" "pxl8_waf_custom" {
  count       = local.pxl8_enabled ? 1 : 0
  zone_id     = var.pxl8_zone_id
  name        = "PXL8 custom WAF rules"
  description = "Free tier firewall rules with payment webhook exceptions"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [
    {
      action = "block"
      expression = join(" or ", [
        "((cf.client.bot) and (http.request.uri.path contains \"/api/\") and (http.request.uri.path ne \"/api/obj/health\") and (http.request.uri.path ne \"/api/obj/stripe-webhook\") and (http.request.uri.path ne \"/api/obj/paypal-webhook\"))",
        "lower(http.user_agent) contains \"amazonbot\"",
        "lower(http.user_agent) contains \"applebot-extended\"",
        "lower(http.user_agent) contains \"bytespider\"",
        "lower(http.user_agent) contains \"ccbot\"",
        "lower(http.user_agent) contains \"claudebot\"",
        "lower(http.user_agent) contains \"google-extended\"",
        "lower(http.user_agent) contains \"gptbot\"",
        "lower(http.user_agent) contains \"meta-externalagent\"",
        "lower(http.user_agent) contains \"perplexitybot\"",
      ])
      description = "Block bots on APIs and declared AI crawlers"
      enabled     = true
    },
    {
      action      = "block"
      expression  = "(http.user_agent eq \"\") and (http.request.uri.path contains \"/api/\")"
      description = "Block empty user agents on API"
      enabled     = true
    },
    {
      action      = "block"
      expression  = "(http.request.uri.query contains \"<script\") or (http.request.uri.query contains \"SELECT \") or (http.request.uri.query contains \"UNION \")"
      description = "Block common SQL injection and XSS attempts"
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
      expression  = format("(lower(http.host) ne \"%s\") and (not ends_with(lower(http.host), \".%s\"))", lower(var.pxl8_domain), lower(var.pxl8_domain))
      description = "Block requests outside the PXL8 domain"
      enabled     = true
    },
  ]
}

resource "cloudflare_ruleset" "pxl8_noindex_headers" {
  count       = local.pxl8_enabled ? 1 : 0
  zone_id     = var.pxl8_zone_id
  name        = "PXL8 no-index response headers"
  description = "Keep the public sandbox out of search and AI indexes"
  kind        = "zone"
  phase       = "http_response_headers_transform"

  rules = [
    {
      ref         = "set_pxl8_noindex_header"
      action      = "rewrite"
      description = "Set X-Robots-Tag on every PXL8 response"
      enabled     = true
      expression  = "true"
      action_parameters = {
        headers = {
          "X-Robots-Tag" = {
            operation = "set"
            value     = "noindex, nofollow, noarchive, nosnippet, noimageindex"
          }
        }
      }
    },
  ]
}

resource "cloudflare_ruleset" "pxl8_redirects" {
  count       = local.pxl8_enabled ? 1 : 0
  zone_id     = var.pxl8_zone_id
  name        = "PXL8 hostname redirects"
  description = "Redirect www and preview hostnames to the canonical apex"
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  rules = [
    {
      ref         = "redirect_pxl8_aliases_to_apex"
      action      = "redirect"
      description = "Redirect www and we to pxl8.ing"
      enabled     = true
      expression  = format("(lower(http.host) eq \"www.%s\") or (lower(http.host) eq \"we.%s\")", lower(var.pxl8_domain), lower(var.pxl8_domain))
      action_parameters = {
        from_value = {
          status_code = 308
          target_url = {
            expression = format("concat(\"https://%s\", http.request.uri.path)", var.pxl8_domain)
          }
          preserve_query_string = true
        }
      }
    },
  ]
}

resource "cloudflare_ruleset" "pxl8_cache" {
  count       = local.pxl8_enabled ? 1 : 0
  zone_id     = var.pxl8_zone_id
  name        = "PXL8 cache rules"
  description = "Cache immutable Vite assets and bypass API responses"
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
      expression  = "starts_with(http.request.uri.path, \"/assets/\")"
      description = "Cache Vite assets for one year"
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

resource "cloudflare_dns_record" "pxl8_root" {
  count   = local.pxl8_enabled && var.pxl8_create_dns && trimspace(var.pxl8_origin_ipv4) != "" ? 1 : 0
  zone_id = var.pxl8_zone_id
  name    = var.pxl8_domain
  type    = "A"
  content = var.pxl8_origin_ipv4
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "pxl8_www" {
  count   = local.pxl8_enabled && var.pxl8_create_dns && trimspace(var.pxl8_origin_ipv4) != "" ? 1 : 0
  zone_id = var.pxl8_zone_id
  name    = "www"
  type    = "CNAME"
  content = var.pxl8_domain
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "pxl8_we" {
  count   = local.pxl8_enabled && var.pxl8_create_dns && trimspace(var.pxl8_origin_ipv4) != "" ? 1 : 0
  zone_id = var.pxl8_zone_id
  name    = "we"
  type    = "CNAME"
  content = var.pxl8_domain
  proxied = true
  ttl     = 1
}

resource "tls_private_key" "pxl8_origin_ca" {
  count       = local.pxl8_enabled && var.pxl8_create_origin_ca_certificate ? 1 : 0
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "tls_cert_request" "pxl8_origin_ca" {
  count           = local.pxl8_enabled && var.pxl8_create_origin_ca_certificate ? 1 : 0
  private_key_pem = tls_private_key.pxl8_origin_ca[0].private_key_pem
  dns_names       = [var.pxl8_domain, "*.${var.pxl8_domain}"]

  subject {
    common_name = var.pxl8_domain
  }
}

resource "cloudflare_origin_ca_certificate" "pxl8" {
  count              = local.pxl8_enabled && var.pxl8_create_origin_ca_certificate ? 1 : 0
  csr                = tls_cert_request.pxl8_origin_ca[0].cert_request_pem
  request_type       = "origin-ecc"
  hostnames          = [var.pxl8_domain, "*.${var.pxl8_domain}"]
  requested_validity = var.pxl8_origin_ca_requested_validity

  lifecycle {
    ignore_changes  = [hostnames, csr]
    prevent_destroy = true
  }
}

output "pxl8_r2_public_url" {
  value = try("https://${cloudflare_r2_custom_domain.pxl8_media[0].domain}", null)
}

output "pxl8_origin_ca_expires_on" {
  value = try(cloudflare_origin_ca_certificate.pxl8[0].expires_on, null)
}
