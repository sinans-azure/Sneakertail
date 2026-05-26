output "hub_vnet_id" { value = azurerm_virtual_network.hub.id }
output "app_spoke_vnet_id" { value = azurerm_virtual_network.app.id }
output "data_spoke_vnet_id" { value = azurerm_virtual_network.data.id }
output "appgw_subnet_id" { value = azurerm_subnet.appgw.id }
output "frontend_subnet_id" { value = azurerm_subnet.frontend.id }
output "backend_subnet_id" { value = azurerm_subnet.backend.id }
output "postgres_subnet_id" { value = azurerm_subnet.postgres.id }
