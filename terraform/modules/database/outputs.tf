output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.this.fqdn
}

output "postgres_server_id" {
  value = azurerm_postgresql_flexible_server.this.id
}
