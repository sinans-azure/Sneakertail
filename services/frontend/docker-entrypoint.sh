#!/bin/sh
set -eu

export CATALOG_PROXY_URL="${CATALOG_PROXY_URL:-http://catalog-service:4001}"
export CART_PROXY_URL="${CART_PROXY_URL:-http://cart-order-service:4002}"

envsubst '${CATALOG_PROXY_URL} ${CART_PROXY_URL}' \
  < /etc/nginx/conf.d/default.conf \
  > /tmp/default.conf
mv /tmp/default.conf /etc/nginx/conf.d/default.conf

cat > /usr/share/nginx/html/config.js <<EOF
window.SNEAKERTAIL_CONFIG = {
  catalogApi: '${CATALOG_API_URL:-/catalog-api}',
  cartApi: '${CART_API_URL:-/cart-api}',
  fallbackCatalogApi: '${FALLBACK_CATALOG_API_URL:-http://localhost:4001}',
  fallbackCartApi: '${FALLBACK_CART_API_URL:-http://localhost:4002}'
};
EOF

exec nginx -g 'daemon off;'
