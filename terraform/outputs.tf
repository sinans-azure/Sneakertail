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

output "bastion_public_ip" {
  value       = module.bastion.bastion_public_ip
  description = "Public IP address of the Bastion host"
}

output "bastion_private_ip" {
  value       = module.bastion.bastion_private_ip
  description = "Private IP address of the Bastion host"
}

output "bastion_connection_info" {
  value = "Connect to Bastion: ssh ${var.admin_username}@${module.bastion.bastion_public_ip}"
}

output "docs_public_ip" {
  value       = module.docs.docs_public_ip
  description = "Public IP address of the Docs VM (docs.sneakertail.online)"
}

output "docs_private_ip" {
  value       = module.docs.docs_private_ip
  description = "Private IP address of the Docs VM"
}

output "docs_connection_info" {
  value = "Access Docs UI: http://${module.docs.docs_public_ip} or configure docs.sneakertail.online to point to this IP"
}
