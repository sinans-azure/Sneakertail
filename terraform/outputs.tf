output "application_gateway_public_ip" {
  value = module.loadbalancer.public_ip_address
}

output "application_gateway_fqdn_hint" {
  value = "Create DNS A/CNAME records for your demo hostnames to ${module.loadbalancer.public_ip_address}."
}

output "postgres_fqdn" {
  value = module.database.postgres_fqdn
}

output "catalog_private_ip" {
  value = module.compute_backend.catalog_private_ip
}

output "cart_private_ip" {
  value = module.compute_backend.cart_private_ip
}
