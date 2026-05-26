resource "azurerm_virtual_network" "hub" {
  name                = "VNET-1"
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = [var.address_space.hub_vnet]
  tags                = var.tags
}

resource "azurerm_virtual_network" "app" {
  name                = "VNET-2"
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = [var.address_space.app_vnet]
  tags                = var.tags
}

resource "azurerm_virtual_network" "data" {
  name                = "VNET-3"
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = [var.address_space.data_vnet]
  tags                = var.tags
}

resource "azurerm_virtual_network" "docs" {
  name                = "VNET-4"
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = [var.address_space.docs_vnet]
  tags                = var.tags
}

resource "azurerm_subnet" "appgw" {
  name                 = "SNET-1"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = [var.address_space.hub_appgw_subnet]
}

resource "azurerm_subnet" "bastion" {
  name                 = "SNET-2"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = [var.address_space.hub_bastion_subnet]
}

resource "azurerm_subnet" "management" {
  name                 = "SNET-3"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = [var.address_space.hub_management_subnet]
}

resource "azurerm_subnet" "frontend" {
  name                 = "SNET-4"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.app.name
  address_prefixes     = [var.address_space.frontend_subnet]
}

resource "azurerm_subnet" "backend" {
  name                 = "SNET-5"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.app.name
  address_prefixes     = [var.address_space.backend_subnet]
}

resource "azurerm_subnet" "postgres" {
  name                 = "SNET-6"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.data.name
  address_prefixes     = [var.address_space.postgres_subnet]

  delegation {
    name = "postgres-flexible-server-delegation"

    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "docs" {
  name                 = "SNET-7"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.docs.name
  address_prefixes     = [var.address_space.docs_subnet]
}

resource "azurerm_virtual_network_peering" "hub_to_app" {
  name                      = "PEER-1"
  resource_group_name       = var.resource_group_name
  virtual_network_name      = azurerm_virtual_network.hub.name
  remote_virtual_network_id = azurerm_virtual_network.app.id
}

resource "azurerm_virtual_network_peering" "app_to_hub" {
  name                      = "PEER-2"
  resource_group_name       = var.resource_group_name
  virtual_network_name      = azurerm_virtual_network.app.name
  remote_virtual_network_id = azurerm_virtual_network.hub.id
}

resource "azurerm_virtual_network_peering" "app_to_data" {
  name                      = "PEER-3"
  resource_group_name       = var.resource_group_name
  virtual_network_name      = azurerm_virtual_network.app.name
  remote_virtual_network_id = azurerm_virtual_network.data.id
}

resource "azurerm_virtual_network_peering" "data_to_app" {
  name                      = "PEER-4"
  resource_group_name       = var.resource_group_name
  virtual_network_name      = azurerm_virtual_network.data.name
  remote_virtual_network_id = azurerm_virtual_network.app.id
}
