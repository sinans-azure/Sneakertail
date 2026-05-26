variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "name_prefix" { type = string }
variable "backend_subnet_id" { type = string }
variable "vm_size" { type = string }
variable "admin_username" { type = string }
variable "admin_password" {
  type      = string
  sensitive = true
}
variable "repository_url" { type = string }
variable "repository_branch" { type = string }
variable "postgres_fqdn" { type = string }
variable "postgres_database_name" { type = string }
variable "postgres_admin_login" { type = string }
variable "postgres_admin_password" {
  type      = string
  sensitive = true
}
variable "app_gateway_subnet_cidr" { type = string }
variable "tags" { type = map(string) }
