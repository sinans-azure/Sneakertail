resource "azurerm_network_security_group" "frontend" {
  name                = "NSG-2"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags

  security_rule {
    name                       = "AllowAppGatewayHttp"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = var.app_gateway_subnet_cidr
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowSshFromPrivateNetworks"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "frontend" {
  subnet_id                 = var.frontend_subnet_id
  network_security_group_id = azurerm_network_security_group.frontend.id
}

resource "azurerm_linux_virtual_machine_scale_set" "frontend" {
  name                            = "VMSS-1"
  resource_group_name             = var.resource_group_name
  location                        = var.location
  sku                             = var.vm_size
  instances                       = var.instance_count
  admin_username                  = var.admin_username
  admin_password                  = var.admin_password
  disable_password_authentication = false
  upgrade_mode                    = "Automatic"
  custom_data = base64encode(templatefile("${path.module}/cloud-init-frontend.yml", {
    repository_url    = var.repository_url
    repository_branch = var.repository_branch
    catalog_api_url   = var.catalog_api_url
    cart_api_url      = var.cart_api_url
  }))
  tags = var.tags

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }

  network_interface {
    name    = "nic-frontend"
    primary = true

    ip_configuration {
      name                                         = "ipconfig"
      primary                                      = true
      subnet_id                                    = var.frontend_subnet_id
      application_gateway_backend_address_pool_ids = [var.app_gateway_frontend_pool_id]
    }
  }

  depends_on = [azurerm_subnet_network_security_group_association.frontend]
}

resource "azurerm_monitor_autoscale_setting" "frontend" {
  name                = "AS-1"
  resource_group_name = var.resource_group_name
  location            = var.location
  target_resource_id  = azurerm_linux_virtual_machine_scale_set.frontend.id
  tags                = var.tags

  profile {
    name = "cpu-autoscale"

    capacity {
      default = tostring(var.instance_count)
      minimum = tostring(var.autoscale_min_instances)
      maximum = tostring(var.autoscale_max_instances)
    }

    rule {
      metric_trigger {
        metric_name        = "Percentage CPU"
        metric_resource_id = azurerm_linux_virtual_machine_scale_set.frontend.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT10M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = 70
      }

      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }

    rule {
      metric_trigger {
        metric_name        = "Percentage CPU"
        metric_resource_id = azurerm_linux_virtual_machine_scale_set.frontend.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT15M"
        time_aggregation   = "Average"
        operator           = "LessThan"
        threshold          = 30
      }

      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT10M"
      }
    }
  }
}
