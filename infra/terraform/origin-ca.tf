variable "create_cloudflare_origin_ca_certificate" {
  type    = bool
  default = true
}

variable "cloudflare_origin_ca_requested_validity" {
  type    = number
  default = 5475
}

variable "cloudflare_origin_ca_hostnames" {
  type    = list(string)
  default = []
}

locals {
  origin_ca_hostnames = length(var.cloudflare_origin_ca_hostnames) > 0 ? var.cloudflare_origin_ca_hostnames : [
    var.domain,
    "*.${var.domain}",
  ]
}

resource "tls_private_key" "origin_ca" {
  count       = var.enable_cloudflare && var.create_cloudflare_origin_ca_certificate ? 1 : 0
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "tls_cert_request" "origin_ca" {
  count           = var.enable_cloudflare && var.create_cloudflare_origin_ca_certificate ? 1 : 0
  private_key_pem = tls_private_key.origin_ca[0].private_key_pem
  dns_names       = local.origin_ca_hostnames

  subject {
    common_name = var.domain
  }
}

resource "cloudflare_origin_ca_certificate" "origin" {
  count              = var.enable_cloudflare && var.create_cloudflare_origin_ca_certificate ? 1 : 0
  csr                = tls_cert_request.origin_ca[0].cert_request_pem
  request_type       = "origin-ecc"
  hostnames          = local.origin_ca_hostnames
  requested_validity = var.cloudflare_origin_ca_requested_validity

  lifecycle {
    # Cloudflare may reorder hostnames/csr representation, causing needless replacement churn.
    ignore_changes  = [hostnames, csr]
    prevent_destroy = true
  }
}
