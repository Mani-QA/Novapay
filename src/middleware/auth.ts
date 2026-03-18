import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env, AuthUser, User, Session } from '../types';

type Variables = { user: AuthUser };
type AuthContext = Context<{ Bindings: Env; Variables: Variables }>;

export async function authMiddleware(c: AuthContext, next: Next) {
  const token = getCookie(c, 'session_token');

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const session = await c.env.DB.prepare(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime(\'now\')'
  )
    .bind(token)
    .first<Session>();

  if (!session) {
    return c.json({ error: 'Session expired or invalid' }, 401);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(session.user_id)
    .first<User>();

  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  if (user.is_frozen) {
    return c.json({ error: 'Account is frozen. Contact support.' }, 403);
  }

  c.set('user', {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_frozen: user.is_frozen,
  });

  await next();
}

export async function adminMiddleware(c: AuthContext, next: Next) {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  await next();
}
