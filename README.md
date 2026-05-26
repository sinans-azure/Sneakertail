# sneakertail.online

Microservices boilerplate for a sneaker store clone with:

- `services/frontend`: static HTML, CSS, and JavaScript storefront.
- `services/catalog-service`: inventory, product detail, and pricing API.
- `services/cart-order-service`: shopping session, cart, and checkout API.
- `infra/postgres`: shared PostgreSQL initialization for isolated schemas.

## Directory Structure

```text
Sneakertail/
  docker-compose.yml
  package.json
  infra/
    postgres/
      init.sql
  services/
    frontend/
      Dockerfile
      nginx.conf
      index.html
      styles.css
      app.js
      config.js
    catalog-service/
      Dockerfile
      src/
      db/
    cart-order-service/
      Dockerfile
      src/
      db/
```

## Local Run

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:8080`
- Catalog API: `http://localhost:4001`
- Cart & Order API: `http://localhost:4002`
- PostgreSQL: localhost:5432

The frontend uses same-origin proxy paths by default:

- `/catalog-api` -> Catalog Service
- `/cart-api` -> Cart & Order Service

For direct non-Docker frontend development, edit `services/frontend/config.js` and set those values to `http://localhost:4001` and `http://localhost:4002`.

Terraform for the Azure demo environment is available in `terraform/`. See `terraform/README.md` for deployment commands and module details.

## Azure Architecture Plan

This project is suitable for a VM-based Azure demonstration with Application Gateway, WAF, VM Scale Sets, VNet peering, and Azure Database for PostgreSQL Flexible Server.

### Target Layout

- Hub VNet: shared ingress and security services.
- Spoke App VNet: frontend, catalog, and cart/order VM Scale Sets.
- Spoke Data VNet: Azure Database for PostgreSQL private endpoint, if you want stronger isolation.
- VNet peering:
  - Hub VNet <-> App Spoke VNet.
  - App Spoke VNet <-> Data Spoke VNet, or App Spoke directly to a PostgreSQL delegated subnet/private endpoint.
- Azure Application Gateway v2 with WAF enabled in the Hub VNet.
- Backend pools:
  - Frontend VMSS backend pool on port `80`.
  - Catalog VMSS backend pool on port `4001`.
  - Cart/Order VMSS backend pool on port `4002`.
- Azure Database for PostgreSQL Flexible Server:
  - One PostgreSQL server/database.
  - `catalog` schema owned by Catalog Service.
  - `orders` schema owned by Cart & Order Service.

### Suggested Subnets

```text
hub-vnet
  appgw-subnet              10.0.1.0/24
  bastion-or-management     10.0.2.0/24

app-spoke-vnet
  frontend-vmss-subnet      10.1.1.0/24
  backend-vmss-subnet       10.1.2.0/24

data-spoke-vnet
  postgres-private-subnet   10.2.1.0/24
```

### Path-Based Routing Demo

Use one public hostname, for example:

```text
https://sneakertail.online
```

Application Gateway routing rules:

- `/` -> Frontend VMSS on port `80`.
- `/catalog-api/*` -> Catalog VMSS on port `4001`.
- `/cart-api/*` -> Cart/Order VMSS on port `4002`.

The current frontend defaults already match this pattern:

- `CATALOG_API_URL=/catalog-api`
- `CART_API_URL=/cart-api`

For this mode, keep the frontend container environment like this:

```bash
CATALOG_API_URL=/catalog-api
CART_API_URL=/cart-api
```

### Host-Name Based Routing Demo

Use separate hostnames:

```text
https://www.sneakertail.online        -> Frontend VMSS
https://catalog.sneakertail.online    -> Catalog VMSS
https://cart.sneakertail.online       -> Cart/Order VMSS
```

Application Gateway multi-site listeners:

- Listener `www.sneakertail.online` -> Frontend backend pool.
- Listener `catalog.sneakertail.online` -> Catalog backend pool.
- Listener `cart.sneakertail.online` -> Cart/Order backend pool.

For this mode, set the frontend container environment to:

```bash
CATALOG_API_URL=https://catalog.sneakertail.online
CART_API_URL=https://cart.sneakertail.online
```

### WAF

Enable Application Gateway WAF_v2:

- Start with Detection mode while testing.
- Switch to Prevention mode for the final demo.
- Use OWASP managed rules.
- Add exclusions only if a real application request is blocked.
- Send diagnostic logs to Log Analytics.

### VM Scale Sets And Autoscaling

Create one VMSS per service type:

- `frontend-vmss`
- `catalog-vmss`
- `cart-order-vmss`

Install Docker on each VMSS instance through cloud-init/custom script, then run the matching service container.

Recommended autoscale rules:

- Minimum instances: `2`.
- Maximum instances: `5`.
- Scale out when average CPU is above `70%` for 10 minutes.
- Scale in when average CPU is below `30%` for 15 minutes.

Use Application Gateway health probes:

- Frontend: `/`
- Catalog: `/health`
- Cart/Order: `/health`

### PostgreSQL

For Azure Database for PostgreSQL Flexible Server, point both backend services to the same server/database and enable SSL:

```bash
DATABASE_URL=postgres://<user>:<password>@<server>.postgres.database.azure.com:5432/<database>
DB_SSL=true
```

Recommended setup:

- Use private access/private endpoint where possible.
- Allow traffic only from backend VMSS subnet or VNet.
- Store database passwords in Key Vault for production.
- Use separate database roles later if you want stricter schema-level permissions.

### Deployment Order

1. Build and push images to Azure Container Registry.
2. Create hub VNet, app spoke VNet, and optional data spoke VNet.
3. Configure VNet peering.
4. Create Azure Database for PostgreSQL Flexible Server.
5. Create VM Scale Sets and run service containers.
6. Create Application Gateway WAF_v2.
7. Add backend pools, probes, listeners, and routing rules.
8. Configure DNS records for path-based or host-name based routing.
9. Test health endpoints and the full UI checkout flow.

## Test Checklist

Use this list after Docker Compose or Azure deployment:

- Open the storefront and confirm sneaker products load from the Catalog API.
- Click featured carousel up/down controls and confirm the hero image changes.
- Search for a product or brand and confirm the product grid filters.
- Click a category chip and confirm the product grid filters.
- Click `Clear filters` and confirm all products return.
- Click `Login to add` while logged out and confirm the login page opens.
- Click `Create an account` and confirm the separate registration page opens.
- Register a new user with name, email, and password.
- Confirm the header changes from `Guest` to the registered user name.
- Click `Add to cart` on a product and confirm the cart page opens with that item.
- Click `+` and `-` in the cart page and confirm quantity and total update.
- Reduce an item to `0` and confirm it is removed from the cart.
- Click `Checkout` and confirm the checkout page opens.
- Enter email, cardholder name, card number, expiry, and CVV.
- Try fewer than 16 card digits and confirm the warning says the card number must contain exactly 16 digits.
- Try missing expiry or CVV and confirm the exact missing-field warning appears.
- Click `Place order` and confirm the order success page appears with an order number and card last 4.
- After checkout, add another item and confirm a fresh cart is created.
- Click `Logout` and confirm adding to cart requires login again.
- Visit `http://<host>:4001/health` and confirm the Catalog API returns `ok`.
- Visit `http://<host>:4002/health` and confirm the Cart & Order API returns `ok`.
- Visit `http://<host>:4001/api/products` and confirm JSON product data is returned.

## Current Features

- Static HTML/CSS/JS storefront with no React, Vite, or Tailwind runtime.
- Catalog search by product, brand, and category.
- Category chips with active filter state.
- Featured sneaker vertical carousel.
- User registration and login.
- Separate login and registration pages.
- Add-to-cart gated by login.
- User-owned cart stored in PostgreSQL.
- Cart page with quantity increase, decrease, and remove-at-zero behavior.
- Checkout page with required demo card fields.
- Field-level checkout validation before the API request.
- Order creation with card last 4 only; full card number is not stored.
- Success page after checkout.
- Runtime frontend API configuration for Docker Compose and Azure VM deployment.

## Database Boundary Strategy

The stack uses one PostgreSQL server with two logical schemas:

- `catalog`: products and inventory.
- `orders`: carts, cart items, and orders.

In Azure, this maps cleanly to one Azure Database for PostgreSQL Flexible Server. Each service can be given a schema-scoped connection role later through Terraform.
