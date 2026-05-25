import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { cartRouter } from './cart.js';
import { ensureSchema, pool, query } from './db.js';

const app = express();
const port = Number(process.env.PORT || 4002);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

app.get('/health', async (_req, res, next) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', service: 'cart-order-service' });
  } catch (error) {
    next(error);
  }
});

app.use('/api/cart', cartRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
  });
});

await ensureSchema();

const server = app.listen(port, () => {
  console.log(`cart-order-service listening on ${port}`);
});

function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
