# hetzner.tf - Hetzner infrastructure and bootstrap

provider "hcloud" {
  token = var.hcloud_token
}

variable "hcloud_token" {
  type      = string
  sensitive = true
}

variable "enable_hetzner" {
  type    = bool
  default = false
}

variable "hetzner_server_name" {
  type    = string
  default = "pixelating-web"
}

variable "hetzner_server_type" {
  type    = string
  default = "cpx21"
}

variable "hetzner_server_image" {
  type    = string
  default = "ubuntu-24.04"
}

variable "hetzner_server_location" {
  type    = string
  default = null
}

variable "hetzner_enable_backups" {
  type    = bool
  default = true
}

variable "hetzner_ssh_public_keys" {
  type    = list(string)
  default = []
}

variable "create_hetzner_cloudflare_dns" {
  type    = bool
  default = false
}

variable "create_hetzner_cloudflare_preview_dns" {
  type    = bool
  default = false
}

variable "enable_preview_hostname" {
  type    = bool
  default = true
}

variable "preview_subdomain" {
  type    = string
  default = "we"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.preview_subdomain))
    error_message = "preview_subdomain must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "enable_app_bootstrap" {
  type    = bool
  default = true
}

variable "app_repo_url" {
  type    = string
  default = "https://github.com/pixelating-community/web.git"
}

variable "app_repo_branch" {
  type    = string
  default = "main"
}

variable "app_repo_path" {
  type    = string
  default = "/var/www/web"
}

variable "app_compose_file" {
  type    = string
  default = "production.yml"
}

variable "app_port" {
  type    = number
  default = 3000
}

variable "app_env_content" {
  type      = string
  default   = ""
  sensitive = true
}

variable "nginx_limit_req_rate" {
  type    = string
  default = "30r/s"
}

variable "nginx_limit_req_burst" {
  type    = number
  default = 60
}

variable "nginx_api_limit_req_rate" {
  type    = string
  default = "10r/s"
}

variable "nginx_api_limit_req_burst" {
  type    = number
  default = 25
}

variable "nginx_admin_limit_req_rate" {
  type    = string
  default = "1r/s"
}

variable "nginx_admin_limit_req_burst" {
  type    = number
  default = 5
}

variable "nginx_limit_conn_per_ip" {
  type    = number
  default = 40
}

variable "nginx_client_max_body_size" {
  type    = string
  default = "110m"
}

variable "nginx_restrict_direct_origin_access" {
  type    = bool
  default = true
}

locals {
  hetzner_ssh_key_map = {
    for key in var.hetzner_ssh_public_keys :
    substr(md5(key), 0, 12) => key
  }
  preview_fqdn = "${var.preview_subdomain}.${var.domain}"

  # Keep this list synchronized with https://www.cloudflare.com/ips/.
  # Cloudflare recommends allowing these proxy ranges and blocking all other
  # direct web traffic so requests cannot bypass its protections.
  cloudflare_proxy_source_ips = [
    "173.245.48.0/20",
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "141.101.64.0/18",
    "108.162.192.0/18",
    "190.93.240.0/20",
    "188.114.96.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17",
    "162.158.0.0/15",
    "104.16.0.0/13",
    "104.24.0.0/14",
    "172.64.0.0/13",
    "131.0.72.0/22",
    "2400:cb00::/32",
    "2606:4700::/32",
    "2803:f800::/32",
    "2405:b500::/32",
    "2405:8100::/32",
    "2a06:98c0::/29",
    "2c0f:f248::/32",
  ]

  hetzner_bootstrap_user_data = templatefile("${path.module}/templates/server-bootstrap.sh.tftpl", {
    domain                              = var.domain
    enable_preview_hostname             = var.enable_preview_hostname
    preview_fqdn                        = local.preview_fqdn
    r2_wav_public_url                   = try("https://${cloudflare_r2_custom_domain.audio[0].domain}", "")
    app_port                            = var.app_port
    app_repo_url                        = var.app_repo_url
    app_repo_branch                     = var.app_repo_branch
    app_repo_path                       = var.app_repo_path
    app_compose_file                    = var.app_compose_file
    enable_app_bootstrap                = var.enable_app_bootstrap
    app_env_content_b64                 = base64encode(var.app_env_content)
    nginx_limit_req_rate                = var.nginx_limit_req_rate
    nginx_limit_req_burst               = var.nginx_limit_req_burst
    nginx_api_limit_req_rate            = var.nginx_api_limit_req_rate
    nginx_api_limit_req_burst           = var.nginx_api_limit_req_burst
    nginx_admin_limit_req_rate          = var.nginx_admin_limit_req_rate
    nginx_admin_limit_req_burst         = var.nginx_admin_limit_req_burst
    nginx_limit_conn_per_ip             = var.nginx_limit_conn_per_ip
    nginx_client_max_body_size          = var.nginx_client_max_body_size
    nginx_restrict_direct_origin_access = var.nginx_restrict_direct_origin_access
    enable_origin_tls                   = var.enable_cloudflare && var.create_cloudflare_origin_ca_certificate
    cloudflare_origin_certificate_pem   = try(cloudflare_origin_ca_certificate.origin[0].certificate, "")
    cloudflare_origin_private_key_pem   = try(tls_private_key.origin_ca[0].private_key_pem, "")
  })
}

resource "hcloud_ssh_key" "deployer" {
  for_each   = var.enable_hetzner ? local.hetzner_ssh_key_map : {}
  name       = "${var.hetzner_server_name}-${each.key}"
  public_key = each.value
}

resource "hcloud_firewall" "web" {
  count = var.enable_hetzner ? 1 : 0
  name  = "${var.hetzner_server_name}-fw"

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = var.enable_cloudflare ? local.cloudflare_proxy_source_ips : ["0.0.0.0/0", "::/0"]
  }

  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = var.enable_cloudflare ? local.cloudflare_proxy_source_ips : ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "web" {
  count       = var.enable_hetzner ? 1 : 0
  name        = var.hetzner_server_name
  server_type = var.hetzner_server_type
  image       = var.hetzner_server_image
  location    = var.hetzner_server_location
  backups     = var.hetzner_enable_backups
  firewall_ids = [
    hcloud_firewall.web[0].id,
  ]
  ssh_keys  = [for key in hcloud_ssh_key.deployer : key.name]
  user_data = local.hetzner_bootstrap_user_data

  lifecycle {
    ignore_changes = [user_data]
  }
}

resource "cloudflare_dns_record" "hetzner_root" {
  count   = var.enable_hetzner && var.enable_cloudflare && var.create_hetzner_cloudflare_dns ? 1 : 0
  zone_id = var.zone_id
  name    = var.domain
  type    = "A"
  content = hcloud_server.web[0].ipv4_address
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "hetzner_www" {
  count   = var.enable_hetzner && var.enable_cloudflare && var.create_hetzner_cloudflare_dns ? 1 : 0
  zone_id = var.zone_id
  name    = "www"
  type    = "CNAME"
  content = var.domain
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "hetzner_dev" {
  count   = var.enable_hetzner && var.enable_cloudflare && var.create_hetzner_cloudflare_preview_dns && var.enable_preview_hostname ? 1 : 0
  zone_id = var.zone_id
  name    = var.preview_subdomain
  type    = "A"
  content = hcloud_server.web[0].ipv4_address
  proxied = true
  ttl     = 1
}
