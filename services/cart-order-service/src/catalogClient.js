const catalogBaseUrl = process.env.CATALOG_SERVICE_URL || 'http://localhost:4001';

export async function getProduct(productId) {
  const response = await fetch(`${catalogBaseUrl}/api/products/${productId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Catalog service returned ${response.status}`);
  }

  const payload = await response.json();
  return payload.data;
}
