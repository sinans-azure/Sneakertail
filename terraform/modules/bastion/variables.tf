variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "tags" { type = map(string) }
variable "bastion_subnet_id" { type = string }
variable "admin_username" { type = string }
variable "admin_password" { 
  type      = string
  sensitive = true 
}
variable "vm_size" {
  type    = string
  default = "Standard_B1s"
}
