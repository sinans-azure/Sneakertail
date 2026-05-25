import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_SIZE || 10),
  idleTimeoutMillis: 30000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureSchema() {
  await query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await query('CREATE SCHEMA IF NOT EXISTS orders');
  await query(`
    CREATE TABLE IF NOT EXISTS orders.carts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query('ALTER TABLE orders.carts DROP CONSTRAINT IF EXISTS carts_session_id_key');
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS carts_active_session_idx
      ON orders.carts (session_id)
      WHERE status = 'active'
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS orders.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS orders.user_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES orders.users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS orders.cart_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cart_id UUID NOT NULL REFERENCES orders.carts(id) ON DELETE CASCADE,
      product_id UUID NOT NULL,
      product_name TEXT NOT NULL,
      unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (cart_id, product_id)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS orders.orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cart_id UUID NOT NULL REFERENCES orders.carts(id),
      user_id UUID REFERENCES orders.users(id),
      customer_email TEXT NOT NULL,
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
      cardholder_name TEXT,
      card_last4 TEXT,
      status TEXT NOT NULL DEFAULT 'accepted',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query('ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES orders.users(id)');
  await query('ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS cardholder_name TEXT');
  await query('ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS card_last4 TEXT');
}
