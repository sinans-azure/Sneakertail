variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "name_prefix" { type = string }
variable "postgres_subnet_id" { type = string }
variable "app_spoke_vnet_id" { type = string }
variable "data_spoke_vnet_id" { type = string }
variable "administrator_login" { type = string }
variable "administrator_password" {
  type      = string
  sensitive = true
}
variable "postgres_database_name" { type = string }
variable "postgres_sku_name" { type = string }
variable "postgres_storage_mb" { type = number }
variable "tags" { type = map(string) }
