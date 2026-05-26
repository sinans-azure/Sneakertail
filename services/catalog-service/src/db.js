import pg from 'pg';

const { Pool } = pg;

export const schema = process.env.DB_SCHEMA || 'catalog';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_SIZE || 10),
  idleTimeoutMillis: 30000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function ensureSchema() {
  await query('CREATE SCHEMA IF NOT EXISTS catalog');
  await query(`
    CREATE TABLE IF NOT EXISTS catalog.products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      price_cents INTEGER NOT NULL CHECK (price_cents > 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      is_featured BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(`
    INSERT INTO catalog.products
      (slug, name, brand, category, description, image_url, price_cents, stock, is_featured)
    VALUES
      ('air-stride-neo', 'Air Stride Neo', 'Nike', 'Running', 'Responsive everyday runner with a sculpted foam midsole.', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80', 14900, 24, true),
      ('court-legacy-pro', 'Court Legacy Pro', 'Adidas', 'Lifestyle', 'Clean court profile with a premium leather upper.', 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80', 12900, 18, true),
      ('pulse-knit-90', 'Pulse Knit 90', 'New Balance', 'Training', 'Sock-like knit trainer built for long city days.', 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80', 11900, 32, false),
      ('retro-high-77', 'Retro High 77', 'Converse', 'High Tops', 'Vintage-inspired high top with cushioned street comfort.', 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80', 9900, 15, true),
      ('foam-runner-lite', 'Foam Runner Lite', 'Yeezy', 'Slides', 'Ventilated molded silhouette for warm weather rotation.', 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?auto=format&fit=crop&w=1200&q=80', 8900, 12, false)
    ON CONFLICT (slug) DO NOTHING
  `);
}
