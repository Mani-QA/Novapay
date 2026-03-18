import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';

import authRoutes from './routes/auth';
import accountRoutes from './routes/accounts';
import payeeRoutes from './routes/payees';
import transferRoutes from './routes/transfers';
import adminRoutes from './routes/admin';
import notificationRoutes from './routes/notifications';
import userRoutes from './routes/users';

const app = new Hono<{ Bindings: Env }>();

app.use(
  '/api/*',
  cors({
    origin: (origin) => origin,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

app.route('/api/auth', authRoutes);
app.route('/api/accounts', accountRoutes);
app.route('/api/payees', payeeRoutes);
app.route('/api/transfers', transferRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/notifications', notificationRoutes);
app.route('/api/users', userRoutes);

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.all('*', async (c) => {
  try {
    const response = await c.env.ASSETS.fetch(c.req.raw);
    if (response.status === 404) {
      return c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url)));
    }
    return response;
  } catch {
    return c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url)));
  }
});

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
