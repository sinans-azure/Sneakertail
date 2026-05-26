terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "= 4.71.0"
    }
  }

  # Local state is intentional for this demo. For team/production usage, replace
  # this with an azurerm backend.
}

provider "azurerm" {
  features {}
}
