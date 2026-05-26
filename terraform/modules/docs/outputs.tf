output "docs_public_ip" { value = azurerm_public_ip.docs.ip_address }
output "docs_private_ip" { value = azurerm_network_interface.docs.private_ip_address }
output "docs_vm_id" { value = azurerm_linux_virtual_machine.docs.id }
