variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "name_prefix" { type = string }
variable "tags" { type = map(string) }

variable "address_space" {
  type = object({
    hub_vnet           = string
    hub_appgw_subnet   = string
    hub_bastion_subnet = string
    app_vnet           = string
    frontend_subnet    = string
    backend_subnet     = string
    data_vnet          = string
    postgres_subnet    = string
    docs_vnet          = string
    docs_subnet        = string
  })
}
