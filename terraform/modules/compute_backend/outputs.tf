output "catalog_private_ip" {
  value = azurerm_network_interface.catalog.private_ip_address
}

output "cart_private_ip" {
  value = azurerm_network_interface.cart.private_ip_address
}
