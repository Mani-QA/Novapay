import { Hono } from 'hono';
import type { Env, AuthUser } from '../types';
import { authMiddleware } from '../middleware/auth';

const users = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

users.use('*', authMiddleware);

users.get('/:id/lookup', async (c) => {
  const currentUser = c.get('user');
  const targetId = c.req.param('id');

  if (targetId === currentUser.id) {
    return c.json({ error: 'Cannot look up yourself' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, full_name FROM users WHERE id = ? AND is_frozen = 0'
  ).bind(targetId).first<{ id: string; full_name: string }>();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const checkingAccount = await c.env.DB.prepare(
    "SELECT id, account_name FROM accounts WHERE user_id = ? AND account_type = 'checking' ORDER BY created_at ASC LIMIT 1"
  ).bind(targetId).first<{ id: string; account_name: string }>();

  return c.json({
    user_id: user.id,
    full_name: user.full_name,
    checking_account_id: checkingAccount?.id ?? null,
  });
});

export default users;
