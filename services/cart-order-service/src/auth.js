import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { Router } from 'express';
import { query } from './db.js';

const scrypt = promisify(scryptCallback);
const sessionDays = Number(process.env.SESSION_DAYS || 7);

export const authRouter = Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash || '').split(':');

  if (!salt || !key) {
    return false;
  }

  const hash = await scrypt(password, salt, 64);
  const stored = Buffer.from(key, 'hex');

  return stored.length === hash.length && timingSafeEqual(stored, hash);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);

  await query(
    `INSERT INTO orders.user_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3::int))`,
    [userId, tokenHash, sessionDays]
  );

  return token;
}

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return res.status(401).json({ error: 'Login required' });
    }

    const result = await query(
      `SELECT u.id, u.name, u.email
       FROM orders.user_sessions s
       JOIN orders.users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()
       LIMIT 1`,
      [hashToken(token)]
    );

    if (!result.rowCount) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    req.user = result.rows[0];
    return next();
  } catch (error) {
    return next(error);
  }
}

authRouter.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!name || !email || password.length < 6) {
      return res.status(400).json({ error: 'Name, email, and a 6+ character password are required' });
    }

    const passwordHash = await hashPassword(password);
    const created = await query(
      `INSERT INTO orders.users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, passwordHash]
    ).catch((error) => {
      if (error.code === '23505') {
        error.status = 409;
        error.message = 'Email is already registered';
      }
      throw error;
    });

    const token = await createSession(created.rows[0].id);
    return res.status(201).json({ data: { user: publicUser(created.rows[0]), token } });
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const result = await query('SELECT id, name, email, password_hash FROM orders.users WHERE email = $1 LIMIT 1', [
      email
    ]);

    if (!result.rowCount || !(await verifyPassword(password, result.rows[0].password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = await createSession(result.rows[0].id);
    return res.json({ data: { user: publicUser(result.rows[0]), token } });
  } catch (error) {
    return next(error);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ data: { user: publicUser(req.user) } });
});

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const token = req.headers.authorization.slice(7);
    await query('DELETE FROM orders.user_sessions WHERE token_hash = $1', [hashToken(token)]);
    res.json({ data: { ok: true } });
  } catch (error) {
    next(error);
  }
});
