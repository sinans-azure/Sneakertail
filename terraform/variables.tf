variable "name_prefix" {
  type        = string
  description = "Short lowercase prefix used for DNS-compatible Azure resource names."
  default     = "sneakertail"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group name."
  default     = "RG-1"
}

variable "location" {
  type        = string
  description = "Azure region."
  default     = "Central India"
}

variable "admin_username" {
  type        = string
  description = "Linux VM admin username."
  default     = "azureuser"
}

variable "admin_password" {
  type        = string
  description = "Linux VM admin password."
  sensitive   = true
}

variable "repository_url" {
  type        = string
  description = "Git repository URL containing the Sneakertail app."
  default     = "https://github.com/sinans-azure/Sneakertail.git"
}

variable "repository_branch" {
  type        = string
  description = "Git branch to deploy."
  default     = "main"
}

variable "postgres_admin_login" {
  type        = string
  description = "PostgreSQL administrator username."
  default     = "pgadminuser"
}

variable "postgres_admin_password" {
  type        = string
  description = "PostgreSQL administrator password."
  sensitive   = true
}

variable "postgres_database_name" {
  type    = string
  default = "sneakertail"
}

variable "postgres_sku_name" {
  type    = string
  default = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  type    = number
  default = 32768
}

variable "backend_vm_size" {
  type    = string
  default = "Standard_B1s"
}

variable "frontend_vm_size" {
  type    = string
  default = "Standard_B1s"
}

variable "frontend_instance_count" {
  type    = number
  default = 2
}

variable "frontend_autoscale_min_instances" {
  type    = number
  default = 2
}

variable "frontend_autoscale_max_instances" {
  type    = number
  default = 5
}

variable "frontend_probe_host" {
  type        = string
  description = "Host header for frontend health probe."
  default     = "127.0.0.1"
}

variable "address_space" {
  type = object({
    hub_vnet              = string
    hub_appgw_subnet      = string
    hub_bastion_subnet    = string
    hub_management_subnet = string
    app_vnet              = string
    frontend_subnet       = string
    backend_subnet        = string
    data_vnet             = string
    postgres_subnet       = string
    docs_vnet             = string
    docs_subnet           = string
  })
  default = {
    hub_vnet              = "10.0.0.0/16"
    hub_appgw_subnet      = "10.0.1.0/24"
    hub_bastion_subnet    = "10.0.2.0/24"
    hub_management_subnet = "10.0.3.0/24"
    app_vnet              = "10.1.0.0/16"
    frontend_subnet       = "10.1.1.0/24"
    backend_subnet        = "10.1.2.0/24"
    data_vnet             = "10.2.0.0/16"
    postgres_subnet       = "10.2.1.0/24"
    docs_vnet             = "10.3.0.0/16"
    docs_subnet           = "10.3.1.0/24"
  }
}

variable "tags" {
  type = map(string)
  default = {
    app         = "sneakertail"
    environment = "dev"
    managed_by  = "terraform"
  }
}
