import { Router } from 'express';
import { requireAuth } from './auth.js';
import { getProduct } from './catalogClient.js';
import { query, transaction } from './db.js';

export const cartRouter = Router();

cartRouter.use(requireAuth);

function cartSessionId(req) {
  return `user:${req.user.id}`;
}

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
    res.json({ data: await getCartPayload(cartSessionId(req)) });
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

    const payload = await transaction(async (client) => {
      const cart = await getOrCreateCart(cartSessionId(req), client);
      const existingItem = await client.query(
        'SELECT quantity FROM orders.cart_items WHERE cart_id = $1 AND product_id = $2 LIMIT 1',
        [cart.id, product.id]
      );
      const existingQuantity = existingItem.rows[0]?.quantity || 0;

      if (existingQuantity + quantity > product.stock) {
        const error = new Error('Insufficient inventory');
        error.status = 409;
        throw error;
      }

      await client.query(
        `INSERT INTO orders.cart_items (cart_id, product_id, product_name, unit_price_cents, quantity)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (cart_id, product_id)
         DO UPDATE SET
           quantity = orders.cart_items.quantity + EXCLUDED.quantity,
           updated_at = now()`,
        [cart.id, product.id, product.name, product.priceCents, quantity]
      );
      return getCartPayload(cartSessionId(req), client);
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
      const cart = await getOrCreateCart(cartSessionId(req), client);

      if (quantity === 0) {
        await client.query('DELETE FROM orders.cart_items WHERE id = $1 AND cart_id = $2', [
          req.params.itemId,
          cart.id
        ]);
      } else {
        const existing = await client.query(
          'SELECT product_id FROM orders.cart_items WHERE id = $1 AND cart_id = $2 LIMIT 1',
          [req.params.itemId, cart.id]
        );

        if (!existing.rowCount) {
          const error = new Error('Cart item not found');
          error.status = 404;
          throw error;
        }

        const product = await getProduct(existing.rows[0].product_id);

        if (!product || quantity > product.stock) {
          const error = new Error('Insufficient inventory');
          error.status = 409;
          throw error;
        }

        await client.query(
          `UPDATE orders.cart_items
           SET quantity = $1, updated_at = now()
           WHERE id = $2 AND cart_id = $3`,
          [quantity, req.params.itemId, cart.id]
        );
      }

      return getCartPayload(cartSessionId(req), client);
    });

    return res.json({ data: payload });
  } catch (error) {
    return next(error);
  }
});

cartRouter.post('/:sessionId/checkout', async (req, res, next) => {
  try {
    const { customerEmail, cardholderName, cardNumber, expiry, cvv } = req.body;
    const cleanedCardNumber = String(cardNumber || '').replace(/\D/g, '');

    if (!customerEmail || !cardholderName || cleanedCardNumber.length < 12 || !expiry || !cvv) {
      return res.status(400).json({ error: 'Email and complete card details are required' });
    }

    const order = await transaction(async (client) => {
      const cartPayload = await getCartPayload(cartSessionId(req), client);

      if (!cartPayload.items.length) {
        const error = new Error('Cart is empty');
        error.status = 400;
        throw error;
      }

      const created = await client.query(
        `INSERT INTO orders.orders
          (cart_id, user_id, customer_email, total_cents, cardholder_name, card_last4)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, cart_id, user_id, customer_email, total_cents, card_last4, status, created_at`,
        [
          cartPayload.id,
          req.user.id,
          customerEmail,
          cartPayload.totalCents,
          cardholderName,
          cleanedCardNumber.slice(-4)
        ]
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
        userId: order.user_id,
        customerEmail: order.customer_email,
        totalCents: order.total_cents,
        cardLast4: order.card_last4,
        status: order.status,
        createdAt: order.created_at
      }
    });
  } catch (error) {
    return next(error);
  }
});
