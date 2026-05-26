resource "azurerm_resource_group" "this" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

module "networking" {
  source              = "./modules/networking"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  name_prefix         = var.name_prefix
  address_space       = var.address_space
  tags                = var.tags
}

module "database" {
  source                 = "./modules/database"
  resource_group_name    = azurerm_resource_group.this.name
  location               = azurerm_resource_group.this.location
  name_prefix            = var.name_prefix
  postgres_subnet_id     = module.networking.postgres_subnet_id
  app_spoke_vnet_id      = module.networking.app_spoke_vnet_id
  data_spoke_vnet_id     = module.networking.data_spoke_vnet_id
  administrator_login    = var.postgres_admin_login
  administrator_password = var.postgres_admin_password
  postgres_database_name = var.postgres_database_name
  postgres_sku_name      = var.postgres_sku_name
  postgres_storage_mb    = var.postgres_storage_mb
  tags                   = var.tags
}

module "compute_backend" {
  source                  = "./modules/compute_backend"
  resource_group_name     = azurerm_resource_group.this.name
  location                = azurerm_resource_group.this.location
  name_prefix             = var.name_prefix
  backend_subnet_id       = module.networking.backend_subnet_id
  vm_size                 = var.backend_vm_size
  admin_username          = var.admin_username
  admin_password          = var.admin_password
  repository_url          = var.repository_url
  repository_branch       = var.repository_branch
  postgres_fqdn           = module.database.postgres_fqdn
  postgres_database_name  = var.postgres_database_name
  postgres_admin_login    = var.postgres_admin_login
  postgres_admin_password = var.postgres_admin_password
  app_gateway_subnet_cidr = var.address_space.hub_appgw_subnet
  tags                    = var.tags

  depends_on = [module.database]
}

module "loadbalancer" {
  source              = "./modules/loadbalancer"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  name_prefix         = var.name_prefix
  appgw_subnet_id     = module.networking.appgw_subnet_id
  frontend_probe_host = var.frontend_probe_host
  catalog_private_ip  = module.compute_backend.catalog_private_ip
  cart_private_ip     = module.compute_backend.cart_private_ip
  frontend_host_name  = var.frontend_host_name
  catalog_host_name   = var.catalog_host_name
  cart_host_name      = var.cart_host_name
  enable_host_routing = var.enable_host_routing
  tags                = var.tags
}

module "compute_frontend" {
  source                       = "./modules/compute_frontend"
  resource_group_name          = azurerm_resource_group.this.name
  location                     = azurerm_resource_group.this.location
  name_prefix                  = var.name_prefix
  frontend_subnet_id           = module.networking.frontend_subnet_id
  app_gateway_frontend_pool_id = module.loadbalancer.frontend_backend_pool_id
  vm_size                      = var.frontend_vm_size
  instance_count               = var.frontend_instance_count
  autoscale_min_instances      = var.frontend_autoscale_min_instances
  autoscale_max_instances      = var.frontend_autoscale_max_instances
  admin_username               = var.admin_username
  admin_password               = var.admin_password
  repository_url               = var.repository_url
  repository_branch            = var.repository_branch
  catalog_api_url              = var.enable_host_routing ? "https://${var.catalog_host_name}" : "/catalog-api"
  cart_api_url                 = var.enable_host_routing ? "https://${var.cart_host_name}" : "/cart-api"
  app_gateway_subnet_cidr      = var.address_space.hub_appgw_subnet
  tags                         = var.tags

  depends_on = [module.loadbalancer]
}