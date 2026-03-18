import { Hono } from 'hono';
import type { Env, Payee, AuthUser } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../utils/crypto';
import { logAudit } from '../utils/audit';

const payees = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

payees.use('*', authMiddleware);

payees.get('/', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    'SELECT * FROM payees WHERE user_id = ? ORDER BY payee_name ASC'
  ).bind(user.id).all<Payee>();
  return c.json({ payees: result.results });
});

payees.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    payee_name: string;
    payee_user_id?: string;
    payee_account_id?: string;
    nickname?: string;
  }>();

  if (!body.payee_name) {
    return c.json({ error: 'Payee name is required' }, 400);
  }

  if (body.payee_user_id) {
    const payeeUser = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
      .bind(body.payee_user_id).first();
    if (!payeeUser) {
      return c.json({ error: 'Payee user not found' }, 404);
    }

    if (body.payee_user_id === user.id) {
      return c.json({ error: 'Cannot add yourself as a payee' }, 400);
    }
  }

  if (body.payee_account_id) {
    const payeeAccount = await c.env.DB.prepare('SELECT id FROM accounts WHERE id = ?')
      .bind(body.payee_account_id).first();
    if (!payeeAccount) {
      return c.json({ error: 'Payee account not found' }, 404);
    }
  }

  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO payees (id, user_id, payee_name, payee_user_id, payee_account_id, nickname) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    user.id,
    body.payee_name,
    body.payee_user_id ?? null,
    body.payee_account_id ?? null,
    body.nickname ?? null
  ).run();

  await logAudit(c.env.DB, user.id, 'PAYEE_CREATED', 'payee', id, `Payee: ${body.payee_name}`);

  const payee = await c.env.DB.prepare('SELECT * FROM payees WHERE id = ?').bind(id).first<Payee>();
  return c.json({ payee }, 201);
});

payees.put('/:id', async (c) => {
  const user = c.get('user');
  const payeeId = c.req.param('id');
  const body = await c.req.json<{
    payee_name?: string;
    payee_user_id?: string;
    payee_account_id?: string;
    nickname?: string;
  }>();

  const existing = await c.env.DB.prepare(
    'SELECT * FROM payees WHERE id = ? AND user_id = ?'
  ).bind(payeeId, user.id).first<Payee>();

  if (!existing) {
    return c.json({ error: 'Payee not found' }, 404);
  }

  const name = body.payee_name ?? existing.payee_name;
  const payeeUserId = body.payee_user_id !== undefined ? body.payee_user_id : existing.payee_user_id;
  const payeeAccountId = body.payee_account_id !== undefined ? body.payee_account_id : existing.payee_account_id;
  const nickname = body.nickname !== undefined ? body.nickname : existing.nickname;

  await c.env.DB.prepare(
    `UPDATE payees SET payee_name = ?, payee_user_id = ?, payee_account_id = ?, nickname = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(name, payeeUserId, payeeAccountId, nickname, payeeId).run();

  await logAudit(c.env.DB, user.id, 'PAYEE_UPDATED', 'payee', payeeId);

  const updated = await c.env.DB.prepare('SELECT * FROM payees WHERE id = ?').bind(payeeId).first<Payee>();
  return c.json({ payee: updated });
});

payees.delete('/:id', async (c) => {
  const user = c.get('user');
  const payeeId = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM payees WHERE id = ? AND user_id = ?'
  ).bind(payeeId, user.id).first<Payee>();

  if (!existing) {
    return c.json({ error: 'Payee not found' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM payees WHERE id = ?').bind(payeeId).run();
  await logAudit(c.env.DB, user.id, 'PAYEE_DELETED', 'payee', payeeId, `Deleted: ${existing.payee_name}`);

  return c.json({ message: 'Payee deleted' });
});

export default payees;
