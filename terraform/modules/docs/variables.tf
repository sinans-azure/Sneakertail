variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "tags" { type = map(string) }
variable "docs_subnet_id" { type = string }
variable "appgw_subnet_cidr" { type = string }
variable "bastion_subnet_cidr" { type = string }
variable "admin_username" { type = string }
variable "admin_password" { 
  type      = string
  sensitive = true 
}
variable "repository_url" { type = string }
variable "repository_branch" { type = string }
variable "vm_size" {
  type    = string
  default = "Standard_B1s"
}
