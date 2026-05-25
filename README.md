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
      src/
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

- Frontend: http://localhost:8080
- Catalog API: http://localhost:4001
- Cart & Order API: http://localhost:4002
- PostgreSQL: localhost:5432

The frontend uses same-origin proxy paths by default:

- `/catalog-api` -> Catalog Service
- `/cart-api` -> Cart & Order Service

For direct non-Docker frontend development, edit `services/frontend/config.js` and set those values to `http://localhost:4001` and `http://localhost:4002`.

## Azure VM Notes

For a VM-based deployment, keep the services on the same Docker network when possible and expose only the frontend publicly. If the frontend, catalog service, and cart service run on separate VMs, set these environment variables on the frontend container:

```bash
CATALOG_API_URL=http://<catalog-vm-public-or-private-ip>:4001
CART_API_URL=http://<cart-vm-public-or-private-ip>:4002
```

For Azure Database for PostgreSQL, point both backend services to the same server/database and enable SSL:

```bash
DATABASE_URL=postgres://<user>:<password>@<server>.postgres.database.azure.com:5432/<database>
DB_SSL=true
```

The catalog service owns the `catalog` schema, and the cart/order service owns the `orders` schema.

## Test Checklist

Use this list after Docker Compose or Azure deployment:

- Open the storefront and confirm sneaker products load from the Catalog API.
- Click featured carousel up/down controls and confirm the hero image changes.
- Search for a product or brand and confirm the product grid filters.
- Click a category chip and confirm the product grid filters.
- Click `Clear filters` and confirm all products return.
- Click `Add to Bag` on a product and confirm the cart opens with that item.
- Click `+` and `-` in the cart and confirm quantity and total update.
- Reduce an item to `0` and confirm it is removed from the cart.
- Enter an email and click `Checkout`; confirm an order accepted message appears.
- After checkout, add another item and confirm a fresh cart is created.
- Visit `http://<host>:4001/health` and confirm the Catalog API returns `ok`.
- Visit `http://<host>:4002/health` and confirm the Cart & Order API returns `ok`.
- Visit `http://<host>:4001/api/products` and confirm JSON product data is returned.

## Database Boundary Strategy

The stack uses one PostgreSQL server with two logical schemas:

- `catalog`: products and inventory.
- `orders`: carts, cart items, and orders.

In Azure, this maps cleanly to one Azure Database for PostgreSQL Flexible Server. Each service can be given a schema-scoped connection role later through Terraform.
