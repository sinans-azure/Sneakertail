locals {
  database_url = "postgres://${var.postgres_admin_login}:${urlencode(var.postgres_admin_password)}@${var.postgres_fqdn}:5432/${var.postgres_database_name}?sslmode=require"
}

resource "azurerm_network_security_group" "backend" {
  name                = "NSG-1"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags

  security_rule {
    name                       = "AllowAppGatewayToCatalog"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "4001"
    source_address_prefix      = var.app_gateway_subnet_cidr
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowAppGatewayToCart"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "4002"
    source_address_prefix      = var.app_gateway_subnet_cidr
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowSshFromPrivateNetworks"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_interface" "catalog" {
  name                = "NIC-1"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags

  ip_configuration {
    name                          = "ipconfig"
    subnet_id                     = var.backend_subnet_id
    private_ip_address_allocation = "Dynamic"
  }
}

resource "azurerm_network_interface" "cart" {
  name                = "NIC-2"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags

  ip_configuration {
    name                          = "ipconfig"
    subnet_id                     = var.backend_subnet_id
    private_ip_address_allocation = "Dynamic"
  }
}

resource "azurerm_network_interface_security_group_association" "catalog" {
  network_interface_id      = azurerm_network_interface.catalog.id
  network_security_group_id = azurerm_network_security_group.backend.id
}

resource "azurerm_network_interface_security_group_association" "cart" {
  network_interface_id      = azurerm_network_interface.cart.id
  network_security_group_id = azurerm_network_security_group.backend.id
}

resource "azurerm_linux_virtual_machine" "catalog" {
  name                            = "VM-1"
  resource_group_name             = var.resource_group_name
  location                        = var.location
  size                            = var.vm_size
  admin_username                  = var.admin_username
  admin_password                  = var.admin_password
  disable_password_authentication = false
  network_interface_ids           = [azurerm_network_interface.catalog.id]
  custom_data = base64encode(templatefile("${path.module}/cloud-init-catalog.yml", {
    repository_url          = var.repository_url
    repository_branch       = var.repository_branch
    database_url            = replace(local.database_url, "%", "%%")
    postgres_fqdn           = var.postgres_fqdn
    postgres_database_name  = var.postgres_database_name
    postgres_admin_login    = var.postgres_admin_login
    postgres_admin_password = var.postgres_admin_password
  }))
  tags = var.tags

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }
}

resource "azurerm_linux_virtual_machine" "cart" {
  name                            = "VM-2"
  resource_group_name             = var.resource_group_name
  location                        = var.location
  size                            = var.vm_size
  admin_username                  = var.admin_username
  admin_password                  = var.admin_password
  disable_password_authentication = false
  network_interface_ids           = [azurerm_network_interface.cart.id]
  custom_data = base64encode(templatefile("${path.module}/cloud-init-cart.yml", {
    repository_url      = var.repository_url
    repository_branch   = var.repository_branch
    database_url        = replace(local.database_url, "%", "%%")
    catalog_service_url = "http://${azurerm_network_interface.catalog.private_ip_address}:4001"
  }))
  tags = var.tags

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }
}
