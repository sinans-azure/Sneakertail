variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "name_prefix" { type = string }
variable "frontend_subnet_id" { type = string }
variable "app_gateway_frontend_pool_id" { type = string }
variable "vm_size" { type = string }
variable "instance_count" { type = number }
variable "autoscale_min_instances" { type = number }
variable "autoscale_max_instances" { type = number }
variable "admin_username" { type = string }
variable "admin_password" {
  type      = string
  sensitive = true
}
variable "repository_url" { type = string }
variable "repository_branch" { type = string }
variable "catalog_api_url" { type = string }
variable "cart_api_url" { type = string }
variable "app_gateway_subnet_cidr" { type = string }
variable "tags" { type = map(string) }
