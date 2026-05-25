#!/bin/sh
set -eu

cat > /usr/share/nginx/html/config.js <<EOF
window.SNEAKERTAIL_CONFIG = {
  catalogApi: '${CATALOG_API_URL:-/catalog-api}',
  cartApi: '${CART_API_URL:-/cart-api}',
  fallbackCatalogApi: '${FALLBACK_CATALOG_API_URL:-http://localhost:4001}',
  fallbackCartApi: '${FALLBACK_CART_API_URL:-http://localhost:4002}'
};
EOF

exec nginx -g 'daemon off;'
