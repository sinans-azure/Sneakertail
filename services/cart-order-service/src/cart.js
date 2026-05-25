import { Router } from 'express';
import { getProduct } from './catalogClient.js';
import { query, transaction } from './db.js';

export const cartRouter = Router();

async function getOrCreateCart(sessionId, client = { query }) {
  const existing = await client.query(
    'SELECT * FROM orders.carts WHERE session_id = $1 AND status = $2 LIMIT 1',
    [sessionId, 'active']
  );

  if (existing.rowCount) {
    return existing.rows[0];
  }

  const created = await client.query(
    'INSERT INTO orders.carts (session_id) VALUES ($1) RETURNING *',
    [sessionId]
  );
  return created.rows[0];
}

async function getCartPayload(sessionId, client = { query }) {
  const cart = await getOrCreateCart(sessionId, client);
  const items = await client.query(
    `SELECT id, product_id, product_name, unit_price_cents, quantity
     FROM orders.cart_items
     WHERE cart_id = $1
     ORDER BY created_at`,
    [cart.id]
  );
  const totalCents = items.rows.reduce(
    (sum, item) => sum + item.unit_price_cents * item.quantity,
    0
  );

  return {
    id: cart.id,
    sessionId: cart.session_id,
    status: cart.status,
    items: items.rows.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      unitPriceCents: item.unit_price_cents,
      quantity: item.quantity
    })),
    totalCents
  };
}

cartRouter.get('/:sessionId', async (req, res, next) => {
  try {
    res.json({ data: await getCartPayload(req.params.sessionId) });
  } catch (error) {
    next(error);
  }
});

cartRouter.post('/:sessionId/items', async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId || quantity < 1) {
      return res.status(400).json({ error: 'productId and positive quantity are required' });
    }

    const product = await getProduct(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(409).json({ error: 'Insufficient inventory' });
    }

    const payload = await transaction(async (client) => {
      const cart = await getOrCreateCart(req.params.sessionId, client);
      await client.query(
        `INSERT INTO orders.cart_items (cart_id, product_id, product_name, unit_price_cents, quantity)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (cart_id, product_id)
         DO UPDATE SET
           quantity = orders.cart_items.quantity + EXCLUDED.quantity,
           updated_at = now()`,
        [cart.id, product.id, product.name, product.priceCents, quantity]
      );
      return getCartPayload(req.params.sessionId, client);
    });

    return res.status(201).json({ data: payload });
  } catch (error) {
    return next(error);
  }
});

cartRouter.patch('/:sessionId/items/:itemId', async (req, res, next) => {
  try {
    const { quantity } = req.body;

    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ error: 'quantity must be a non-negative integer' });
    }

    const payload = await transaction(async (client) => {
      const cart = await getOrCreateCart(req.params.sessionId, client);

      if (quantity === 0) {
        await client.query('DELETE FROM orders.cart_items WHERE id = $1 AND cart_id = $2', [
          req.params.itemId,
          cart.id
        ]);
      } else {
        await client.query(
          `UPDATE orders.cart_items
           SET quantity = $1, updated_at = now()
           WHERE id = $2 AND cart_id = $3`,
          [quantity, req.params.itemId, cart.id]
        );
      }

      return getCartPayload(req.params.sessionId, client);
    });

    return res.json({ data: payload });
  } catch (error) {
    return next(error);
  }
});

cartRouter.post('/:sessionId/checkout', async (req, res, next) => {
  try {
    const { customerEmail } = req.body;

    if (!customerEmail) {
      return res.status(400).json({ error: 'customerEmail is required' });
    }

    const order = await transaction(async (client) => {
      const cartPayload = await getCartPayload(req.params.sessionId, client);

      if (!cartPayload.items.length) {
        const error = new Error('Cart is empty');
        error.status = 400;
        throw error;
      }

      const created = await client.query(
        `INSERT INTO orders.orders (cart_id, customer_email, total_cents)
         VALUES ($1, $2, $3)
         RETURNING id, cart_id, customer_email, total_cents, status, created_at`,
        [cartPayload.id, customerEmail, cartPayload.totalCents]
      );
      await client.query(
        "UPDATE orders.carts SET status = 'checked_out', updated_at = now() WHERE id = $1",
        [cartPayload.id]
      );

      return created.rows[0];
    });

    return res.status(201).json({
      data: {
        id: order.id,
        cartId: order.cart_id,
        customerEmail: order.customer_email,
        totalCents: order.total_cents,
        status: order.status,
        createdAt: order.created_at
      }
    });
  } catch (error) {
    return next(error);
  }
});
