import { Router } from 'express';
import { query } from './db.js';

export const productsRouter = Router();

const mapProduct = (row) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  brand: row.brand,
  category: row.category,
  description: row.description,
  imageUrl: row.image_url,
  priceCents: row.price_cents,
  stock: row.stock,
  isFeatured: row.is_featured
});

productsRouter.get('/', async (req, res, next) => {
  try {
    const { category, featured, q } = req.query;
    const filters = [];
    const params = [];

    if (category) {
      params.push(category);
      filters.push(`category = $${params.length}`);
    }

    if (featured === 'true') {
      filters.push('is_featured = true');
    }

    if (q) {
      params.push(`%${q}%`);
      filters.push(`(name ILIKE $${params.length} OR brand ILIKE $${params.length})`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM catalog.products ${where} ORDER BY is_featured DESC, created_at DESC`,
      params
    );

    res.json({ data: result.rows.map(mapProduct) });
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/categories', async (_req, res, next) => {
  try {
    const result = await query('SELECT DISTINCT category FROM catalog.products ORDER BY category');
    res.json({ data: result.rows.map((row) => row.category) });
  } catch (error) {
    next(error);
  }
});

productsRouter.get('/:idOrSlug', async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const result = await query(
      'SELECT * FROM catalog.products WHERE id::text = $1 OR slug = $1 LIMIT 1',
      [idOrSlug]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json({ data: mapProduct(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});
