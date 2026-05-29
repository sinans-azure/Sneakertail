# Sneakertail Container Apps And Front Door Deployment

This folder demonstrates Sneakertail on Azure Container Apps with Azure Front Door.

The simple demo layout is:

```text
User
  -> Azure Front Door
    -> frontend Container App, external ingress
      -> catalog-service Container App, internal ingress
      -> cart-order-service Container App, internal ingress
        -> Azure PostgreSQL Flexible Server, private access
```

The production-style upgrade is Azure Front Door Premium with Private Link to the Container Apps environment. Keep the simple version first for the demo, then explain the Premium Private Link version as the hardening path.

## What Is Different From AKS

Azure Container Apps has built-in service discovery inside one Container Apps environment. Internal calls should use the container app name:

```text
http://catalog-service
http://cart-order-service
```

For that reason, the frontend image now supports configurable nginx proxy targets:

```text
CATALOG_PROXY_URL=http://catalog-service
CART_PROXY_URL=http://cart-order-service
```

Docker Compose and AKS still work because the frontend defaults remain:

```text
CATALOG_PROXY_URL=http://catalog-service:4001
CART_PROXY_URL=http://cart-order-service:4002
```

## 1. Azure Portal Setup

Create these resources from the Azure Portal:

1. Azure Database for PostgreSQL Flexible Server.
2. Database named `sneakertail`.
3. VNet/subnet for the Container Apps environment.
4. Container Apps environment connected to that VNet.
5. Link the Container Apps VNet to the PostgreSQL private DNS zone.

Use the same PostgreSQL behavior as the working Terraform and AKS deployment:

- PostgreSQL version: `16`
- Database name: `sneakertail`
- SSL: required
- Private DNS must resolve the PostgreSQL FQDN from the Container Apps environment.

Subnet note: Microsoft documents that Container Apps needs a dedicated subnet for the environment. Use at least `/27` for a workload profiles environment.

## 2. Rebuild And Push Docker Hub Images

The frontend image must be rebuilt because it now supports Container Apps proxy targets.

### Option A: GitHub Actions, No Local Docker

Use this option if Docker is not installed locally.

In GitHub, add these repository secrets:

```text
DOCKERHUB_USERNAME=muhammedsinanust
DOCKERHUB_TOKEN=<docker-hub-access-token>
```

Then run the workflow:

```text
GitHub repo -> Actions -> Build and Push Docker Hub Images -> Run workflow
```

The workflow builds and pushes:

```text
muhammedsinanust/sneakertail-frontend:latest
muhammedsinanust/sneakertail-catalog-service:latest
muhammedsinanust/sneakertail-cart-order-service:latest
```

### Option B: Local Docker

From the repository root:

```powershell
docker login

docker build -t muhammedsinanust/sneakertail-frontend:latest -f services/frontend/Dockerfile .
docker build -t muhammedsinanust/sneakertail-catalog-service:latest -f services/catalog-service/Dockerfile .
docker build -t muhammedsinanust/sneakertail-cart-order-service:latest -f services/cart-order-service/Dockerfile .

docker push muhammedsinanust/sneakertail-frontend:latest
docker push muhammedsinanust/sneakertail-catalog-service:latest
docker push muhammedsinanust/sneakertail-cart-order-service:latest
```

## 3. Create Container Apps

You can create the apps from the Portal or use the helper script.

Use these settings:

| App | Image | Ingress | Target port |
| --- | --- | --- | --- |
| `frontend` | `muhammedsinanust/sneakertail-frontend:latest` | External | `80` |
| `catalog-service` | `muhammedsinanust/sneakertail-catalog-service:latest` | Internal | `4001` |
| `cart-order-service` | `muhammedsinanust/sneakertail-cart-order-service:latest` | Internal | `4002` |

Backend environment variables:

```text
NODE_ENV  = production
DB_SSL  = true
DATABASE_URL  = secretref:database-url
```

Catalog additional variable:

```text
PORT=4001
```

Cart/order additional variables:

```text
PORT=4002
CATALOG_SERVICE_URL=http://catalog-service
```

Frontend variables:

```text
CATALOG_API_URL = /catalog-api
CART_API_URL  = /cart-api
CATALOG_PROXY_URL = http://catalog-service
CART_PROXY_URL  = http://cart-order-service
```

The `database-url` secret should look like this:

```text
postgres://pgadminuser:<url-encoded-password>@<postgres-fqdn>:5432/sneakertail?sslmode=require
```

URL-encode special characters in the password. For example, `@` becomes `%40`.

## 4. Optional Script Deployment

From the repository root:

```powershell
.\container-apps\deploy.ps1 `
  -ResourceGroup "RG-1" `
  -Location "centralindia" `
  -EnvironmentName "cae-sneakertail" `
  -InfrastructureSubnetResourceId "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Network/virtualNetworks/<vnet-name>/subnets/<subnet-name>" `
  -DatabaseUrl "postgres://pgadminuser:<url-encoded-password>@<postgres-fqdn>:5432/sneakertail?sslmode=require"
```

To also create Azure Front Door Standard:

```powershell
.\container-apps\deploy.ps1 `
  -ResourceGroup "RG-1" `
  -Location "centralindia" `
  -EnvironmentName "cae-sneakertail" `
  -InfrastructureSubnetResourceId "/subscriptions/<subscription-id>/resourceGroups/<resource-group>/providers/Microsoft.Network/virtualNetworks/<vnet-name>/subnets/<subnet-name>" `
  -DatabaseUrl "postgres://pgadminuser:<url-encoded-password>@<postgres-fqdn>:5432/sneakertail?sslmode=require" `
  -CreateFrontDoor
```

If you already created the Container Apps environment in the Portal, omit `-InfrastructureSubnetResourceId`.

## 5. Create Azure Front Door From Portal

For the simple demo:

1. Create Azure Front Door Standard.
2. Create an endpoint, for example `sneakertail`.
3. Create an origin group.
4. Add the `frontend` Container App FQDN as the origin.
5. Set origin host header to the same frontend Container App FQDN.
6. Use HTTPS to the origin.
7. Add route pattern `/*`.
8. Enable HTTPS redirect.

Then open the Front Door endpoint:

```text
https://<front-door-endpoint>.azurefd.net
```

## 6. Best-Practice Hardening Path

For the production-style version:

- Use Azure Front Door Premium.
- Use Private Link from Front Door to Azure Container Apps.
- Disable public network access for the Container Apps environment where your chosen design supports it.
- Keep catalog and cart/order with internal ingress only.
- Keep PostgreSQL private.
- Move database secrets to Key Vault.
- Add a WAF policy to Front Door.
- Add custom domain and managed TLS certificate.

## 7. Verify

Check the app URLs:

```powershell
az containerapp show --name frontend --resource-group RG-1 --query properties.configuration.ingress.fqdn -o tsv
az afd endpoint show --resource-group RG-1 --profile-name afd-sneakertail --endpoint-name sneakertail --query hostName -o tsv
```

Check logs:

```powershell
az containerapp logs show --name catalog-service --resource-group RG-1 --follow
az containerapp logs show --name cart-order-service --resource-group RG-1 --follow
az containerapp logs show --name frontend --resource-group RG-1 --follow
```

If backend apps fail to start, check:

- PostgreSQL private DNS zone is linked to the Container Apps VNet.
- PostgreSQL FQDN resolves from the Container Apps environment.
- `DATABASE_URL` includes `sslmode=require`.
- `DB_SSL=true`.
- Password is URL-encoded.

If the frontend loads but products do not, check:

- `CATALOG_PROXY_URL=http://catalog-service`
- `CART_PROXY_URL=http://cart-order-service`
- Both backend apps have internal ingress enabled.

## References

- Azure Container Apps ingress: https://learn.microsoft.com/azure/container-apps/ingress-overview
- Container Apps VNet integration: https://learn.microsoft.com/azure/container-apps/vnet-custom-internal
- Container Apps service discovery: https://learn.microsoft.com/azure/container-apps/connect-apps
- Front Door CLI quickstart: https://learn.microsoft.com/azure/frontdoor/create-front-door-cli
- Front Door with Container Apps Private Link: https://learn.microsoft.com/azure/container-apps/how-to-integrate-with-azure-front-door
