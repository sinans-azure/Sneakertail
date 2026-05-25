# sneakertail.online

Microservices boilerplate for a sneaker store clone with:

- `services/frontend`: React + Tailwind CSS storefront.
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

## Database Boundary Strategy

The stack uses one PostgreSQL server with two logical schemas:

- `catalog`: products and inventory.
- `orders`: carts, cart items, and orders.

In Azure, this maps cleanly to one Azure Database for PostgreSQL Flexible Server. Each service can be given a schema-scoped connection role later through Terraform.
