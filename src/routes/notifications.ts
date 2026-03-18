import { Hono } from 'hono';
import type { Env, AuthUser, Notification } from '../types';
import { authMiddleware } from '../middleware/auth';

const notifications = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

notifications.use('*', authMiddleware);

notifications.get('/', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(user.id).all<Notification>();
  return c.json({ notifications: result.results });
});

notifications.get('/unread-count', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).bind(user.id).first<{ count: number }>();
  return c.json({ count: result?.count ?? 0 });
});

notifications.patch('/:id/read', async (c) => {
  const user = c.get('user');
  const notifId = c.req.param('id');

  const notif = await c.env.DB.prepare(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?'
  ).bind(notifId, user.id).first<Notification>();

  if (!notif) {
    return c.json({ error: 'Notification not found' }, 404);
  }

  await c.env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(notifId).run();
  return c.json({ message: 'Marked as read' });
});

notifications.post('/read-all', async (c) => {
  const user = c.get('user');
  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
  ).bind(user.id).run();
  return c.json({ message: 'All notifications marked as read' });
});

export default notifications;
