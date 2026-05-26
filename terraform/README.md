# Sneakertail Azure Terraform

This folder provisions a demo Azure environment for `sneakertail.online`.

## What It Builds

- Resource group.
- Hub VNet with Application Gateway subnet.
- App spoke VNet with frontend VMSS subnet and backend VM subnet.
- Data spoke VNet with delegated PostgreSQL subnet.
- VNet peering:
  - Hub <-> App spoke.
  - App spoke <-> Data spoke.
- Azure Database for PostgreSQL Flexible Server with private DNS.
- Catalog backend Linux VM.
- Cart/order backend Linux VM.
- Frontend Linux VM Scale Set with autoscaling.
- Azure Application Gateway WAF_v2.
- Path-based routing:
  - `/` -> frontend VMSS.
  - `/catalog-api/*` -> catalog VM.
  - `/cart-api/*` -> cart/order VM.
- Optional host-name based routing:
  - `www.sneakertail.online` -> frontend.
  - `catalog.sneakertail.online` -> catalog.
  - `cart.sneakertail.online` -> cart/order.

## Before You Deploy

Create a local `terraform.tfvars` file:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit:

```hcl
admin_password          = "Use-A-Strong-Admin-Password-123!"
postgres_admin_password = "Use-A-Strong-Password-123!"
```

Optional host-routing demo:

```hcl
enable_host_routing = true
frontend_host_name  = "www.sneakertail.online"
catalog_host_name   = "catalog.sneakertail.online"
cart_host_name      = "cart.sneakertail.online"
```

## Deploy

```bash
terraform init
terraform plan -out sneakertail.tfplan
terraform apply sneakertail.tfplan
```

## DNS

After apply, Terraform outputs the Application Gateway public IP.

For path-based routing, point one hostname to that IP:

```text
sneakertail.online -> <app-gateway-public-ip>
```

For host-name based routing, point all demo hostnames to the same IP:

```text
www.sneakertail.online     -> <app-gateway-public-ip>
catalog.sneakertail.online -> <app-gateway-public-ip>
cart.sneakertail.online    -> <app-gateway-public-ip>
```

## Important Demo Notes

- The WAF is set to `Detection` mode to avoid blocking demo traffic while you test.
- VM cloud-init scripts clone the GitHub repo and build Docker images on the VM/VMSS instances.
- For faster and more production-like deployments, build images in CI and pull from Azure Container Registry instead.
- Secrets are currently passed through Terraform/cloud-init for demonstration simplicity. For production, use Key Vault and managed identities.
- Backend VMs do not have public IPs. Application Gateway reaches them privately.
- PostgreSQL public access is disabled and uses private DNS/VNet integration.

## Destroy

```bash
terraform destroy
```
