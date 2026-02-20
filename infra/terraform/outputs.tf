output "r2_wav_public_domain" {
  value = try(cloudflare_r2_custom_domain.audio[0].domain, null)
}

output "r2_wav_public_url" {
  value = try("https://${cloudflare_r2_custom_domain.audio[0].domain}", null)
}

output "hetzner_server_id" {
  value = try(hcloud_server.web[0].id, null)
}

output "hetzner_server_ipv4" {
  value = try(hcloud_server.web[0].ipv4_address, null)
}

output "hetzner_server_name" {
  value = try(hcloud_server.web[0].name, null)
}

output "hetzner_http_url" {
  value = var.enable_hetzner ? "http://${var.domain}" : null
}

output "hetzner_https_url" {
  value = var.enable_hetzner && var.enable_cloudflare && var.create_cloudflare_origin_ca_certificate ? "https://${var.domain}" : null
}

output "hetzner_preview_url" {
  value = var.enable_hetzner && var.enable_preview_hostname ? (var.enable_cloudflare && var.create_cloudflare_origin_ca_certificate ? "https://${var.preview_subdomain}.${var.domain}" : "http://${var.preview_subdomain}.${var.domain}") : null
}

output "hetzner_dev_url" {
  value = var.enable_hetzner && var.enable_preview_hostname ? (var.enable_cloudflare && var.create_cloudflare_origin_ca_certificate ? "https://${var.preview_subdomain}.${var.domain}" : "http://${var.preview_subdomain}.${var.domain}") : null
}

output "cloudflare_origin_ca_expires_on" {
  value = try(cloudflare_origin_ca_certificate.origin[0].expires_on, null)
}
