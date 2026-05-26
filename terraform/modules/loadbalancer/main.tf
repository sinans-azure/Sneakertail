locals {
  frontend_pool_name         = "pool-frontend"
  catalog_pool_name          = "pool-catalog"
  cart_pool_name             = "pool-cart"
  docs_pool_name             = "pool-docs"
  frontend_http_setting_name = "http-frontend"
  catalog_http_setting_name  = "http-catalog"
  cart_http_setting_name     = "http-cart"
  docs_http_setting_name     = "http-docs"
  frontend_probe_name        = "probe-frontend"
  catalog_probe_name         = "probe-catalog"
  cart_probe_name            = "probe-cart"
  docs_probe_name            = "probe-docs"
}

resource "azurerm_public_ip" "appgw" {
  name                = "PIP-1"
  resource_group_name = var.resource_group_name
  location            = var.location
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = ["1", "2", "3"]
  tags                = var.tags
}

resource "azurerm_web_application_firewall_policy" "appgw" {
  name                = "WAF-1"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags

  policy_settings {
    enabled                     = true
    mode                        = "Detection"
    request_body_check          = true
    file_upload_limit_in_mb     = 100
    max_request_body_size_in_kb = 128
  }

  managed_rules {
    managed_rule_set {
      type    = "OWASP"
      version = "3.2"
    }
  }
}

resource "azurerm_application_gateway" "this" {
  name                              = "AGW-1"
  resource_group_name               = var.resource_group_name
  location                          = var.location
  firewall_policy_id                = azurerm_web_application_firewall_policy.appgw.id
  force_firewall_policy_association = true
  tags                              = var.tags

  sku {
    name     = "WAF_v2"
    tier     = "WAF_v2"
    capacity = 2
  }

  gateway_ip_configuration {
    name      = "appgw-ipconfig"
    subnet_id = var.appgw_subnet_id
  }

  frontend_ip_configuration {
    name                 = "public-frontend-ip"
    public_ip_address_id = azurerm_public_ip.appgw.id
  }

  frontend_port {
    name = "port-80"
    port = 80
  }

  backend_address_pool {
    name = local.frontend_pool_name
  }

  backend_address_pool {
    name         = local.catalog_pool_name
    ip_addresses = [var.catalog_private_ip]
  }

  backend_address_pool {
    name         = local.cart_pool_name
    ip_addresses = [var.cart_private_ip]
  }

  backend_address_pool {
    name         = local.docs_pool_name
    ip_addresses = [var.docs_private_ip]
  }

  probe {
    name                                      = local.frontend_probe_name
    protocol                                  = "Http"
    host                                      = var.frontend_probe_host
    path                                      = "/"
    interval                                  = 30
    timeout                                   = 10
    unhealthy_threshold                       = 3
    pick_host_name_from_backend_http_settings = false
  }

  probe {
    name                = local.catalog_probe_name
    protocol            = "Http"
    host                = var.catalog_private_ip
    path                = "/health"
    interval            = 30
    timeout             = 10
    unhealthy_threshold = 3
  }

  probe {
    name                = local.cart_probe_name
    protocol            = "Http"
    host                = var.cart_private_ip
    path                = "/health"
    interval            = 30
    timeout             = 10
    unhealthy_threshold = 3
  }

  probe {
    name                = local.docs_probe_name
    protocol            = "Http"
    host                = var.docs_host_name
    path                = "/"
    interval            = 30
    timeout             = 10
    unhealthy_threshold = 3
  }

  backend_http_settings {
    name                  = local.frontend_http_setting_name
    cookie_based_affinity = "Disabled"
    port                  = 80
    protocol              = "Http"
    request_timeout       = 30
    probe_name            = local.frontend_probe_name
  }

  backend_http_settings {
    name                  = local.catalog_http_setting_name
    cookie_based_affinity = "Disabled"
    port                  = 4001
    protocol              = "Http"
    request_timeout       = 30
    probe_name            = local.catalog_probe_name
  }

  backend_http_settings {
    name                  = local.cart_http_setting_name
    cookie_based_affinity = "Disabled"
    port                  = 4002
    protocol              = "Http"
    request_timeout       = 30
    probe_name            = local.cart_probe_name
  }

  backend_http_settings {
    name                  = local.docs_http_setting_name
    cookie_based_affinity = "Disabled"
    port                  = 80
    protocol              = "Http"
    request_timeout       = 30
    host_name             = var.docs_host_name
    probe_name            = local.docs_probe_name
  }

  http_listener {
    name                           = "listener-path-demo"
    frontend_ip_configuration_name = "public-frontend-ip"
    frontend_port_name             = "port-80"
    protocol                       = "Http"
  }

  http_listener {
    name                           = "listener-docs-host"
    frontend_ip_configuration_name = "public-frontend-ip"
    frontend_port_name             = "port-80"
    protocol                       = "Http"
    host_name                      = var.docs_host_name
  }

  request_routing_rule {
    name               = "rule-path-demo"
    rule_type          = "PathBasedRouting"
    http_listener_name = "listener-path-demo"
    url_path_map_name  = "pathmap-sneakertail"
    priority           = 100
  }

  request_routing_rule {
    name                       = "rule-docs-host"
    rule_type                  = "Basic"
    http_listener_name         = "listener-docs-host"
    backend_address_pool_name  = local.docs_pool_name
    backend_http_settings_name = local.docs_http_setting_name
    priority                   = 90
  }

  url_path_map {
    name                               = "pathmap-sneakertail"
    default_backend_address_pool_name  = local.frontend_pool_name
    default_backend_http_settings_name = local.frontend_http_setting_name

    path_rule {
      name                       = "catalog-api"
      paths                      = ["/catalog-api/*"]
      backend_address_pool_name  = local.catalog_pool_name
      backend_http_settings_name = local.catalog_http_setting_name
    }

    path_rule {
      name                       = "cart-api"
      paths                      = ["/cart-api/*"]
      backend_address_pool_name  = local.cart_pool_name
      backend_http_settings_name = local.cart_http_setting_name
    }
  }
}
