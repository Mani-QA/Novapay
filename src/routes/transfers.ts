import { Hono } from 'hono';
import type { Env, Account, Transaction, AuthUser } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../utils/crypto';
import { logAudit, createNotification } from '../utils/audit';

const transfers = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

transfers.use('*', authMiddleware);

transfers.post('/internal', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    from_account_id: string;
    to_account_id: string;
    amount: number;
    description?: string;
    idempotency_key: string;
  }>();

  if (!body.idempotency_key) {
    return c.json({ error: 'Idempotency key is required' }, 400);
  }

  if (!body.from_account_id || !body.to_account_id || !body.amount) {
    return c.json({ error: 'From account, to account, and amount are required' }, 400);
  }

  if (body.amount <= 0) {
    return c.json({ error: 'Amount must be positive' }, 400);
  }

  if (body.from_account_id === body.to_account_id) {
    return c.json({ error: 'Cannot transfer to the same account' }, 400);
  }

  const existing = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE idempotency_key = ?'
  ).bind(body.idempotency_key).first<Transaction>();

  if (existing) {
    return c.json({ transaction: existing, message: 'Duplicate request' });
  }

  const fromAccount = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(body.from_account_id, user.id).first<Account>();

  const toAccount = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(body.to_account_id, user.id).first<Account>();

  if (!fromAccount || !toAccount) {
    return c.json({ error: 'One or both accounts not found' }, 404);
  }

  const amountPaise = Math.round(body.amount * 100);

  if (fromAccount.balance < amountPaise) {
    return c.json({ error: 'Insufficient funds' }, 400);
  }

  const txId = generateId();

  const batch = [
    c.env.DB.prepare(
      'UPDATE accounts SET balance = balance - ?, updated_at = datetime(\'now\') WHERE id = ? AND balance >= ?'
    ).bind(amountPaise, body.from_account_id, amountPaise),
    c.env.DB.prepare(
      'UPDATE accounts SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(amountPaise, body.to_account_id),
    c.env.DB.prepare(
      `INSERT INTO transactions (id, idempotency_key, from_account_id, to_account_id, amount, type, status, description, created_by)
       VALUES (?, ?, ?, ?, ?, 'internal_transfer', 'completed', ?, ?)`
    ).bind(txId, body.idempotency_key, body.from_account_id, body.to_account_id, amountPaise,
      body.description || 'Internal transfer', user.id),
  ];

  const results = await c.env.DB.batch(batch);

  const debitResult = results[0] as D1Result;
  if (!debitResult.meta.changes || debitResult.meta.changes === 0) {
    await c.env.DB.prepare(
      `UPDATE transactions SET status = 'failed', updated_at = datetime('now') WHERE id = ?`
    ).bind(txId).run();
    return c.json({ error: 'Transfer failed - insufficient funds' }, 400);
  }

  await logAudit(c.env.DB, user.id, 'INTERNAL_TRANSFER', 'transaction', txId,
    `₹${body.amount} from ${body.from_account_id} to ${body.to_account_id}`);

  const tx = await c.env.DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(txId).first<Transaction>();
  return c.json({ transaction: tx }, 201);
});

transfers.post('/external', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    from_account_id: string;
    payee_id: string;
    amount: number;
    description?: string;
    idempotency_key: string;
  }>();

  if (!body.idempotency_key) {
    return c.json({ error: 'Idempotency key is required' }, 400);
  }

  if (!body.from_account_id || !body.payee_id || !body.amount) {
    return c.json({ error: 'From account, payee, and amount are required' }, 400);
  }

  if (body.amount <= 0) {
    return c.json({ error: 'Amount must be positive' }, 400);
  }

  const existing = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE idempotency_key = ?'
  ).bind(body.idempotency_key).first<Transaction>();

  if (existing) {
    return c.json({ transaction: existing, message: 'Duplicate request' });
  }

  const fromAccount = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(body.from_account_id, user.id).first<Account>();

  if (!fromAccount) {
    return c.json({ error: 'Source account not found' }, 404);
  }

  const payee = await c.env.DB.prepare(
    'SELECT * FROM payees WHERE id = ? AND user_id = ?'
  ).bind(body.payee_id, user.id).first<{ id: string; payee_name: string; payee_user_id: string | null; payee_account_id: string | null }>();

  if (!payee) {
    return c.json({ error: 'Payee not found' }, 404);
  }

  if (!payee.payee_account_id) {
    return c.json({ error: 'Payee has no linked account' }, 400);
  }

  const toAccount = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ?'
  ).bind(payee.payee_account_id).first<Account>();

  if (!toAccount) {
    return c.json({ error: 'Payee account not found' }, 404);
  }

  const amountPaise = Math.round(body.amount * 100);

  if (fromAccount.balance < amountPaise) {
    return c.json({ error: 'Insufficient funds' }, 400);
  }

  const txId = generateId();

  const batch = [
    c.env.DB.prepare(
      'UPDATE accounts SET balance = balance - ?, updated_at = datetime(\'now\') WHERE id = ? AND balance >= ?'
    ).bind(amountPaise, body.from_account_id, amountPaise),
    c.env.DB.prepare(
      'UPDATE accounts SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(amountPaise, payee.payee_account_id),
    c.env.DB.prepare(
      `INSERT INTO transactions (id, idempotency_key, from_account_id, to_account_id, amount, type, status, description, created_by)
       VALUES (?, ?, ?, ?, ?, 'external_transfer', 'completed', ?, ?)`
    ).bind(txId, body.idempotency_key, body.from_account_id, payee.payee_account_id, amountPaise,
      body.description || `Transfer to ${payee.payee_name}`, user.id),
  ];

  const results = await c.env.DB.batch(batch);

  const debitResult = results[0] as D1Result;
  if (!debitResult.meta.changes || debitResult.meta.changes === 0) {
    await c.env.DB.prepare(
      `UPDATE transactions SET status = 'failed', updated_at = datetime('now') WHERE id = ?`
    ).bind(txId).run();
    return c.json({ error: 'Transfer failed - insufficient funds' }, 400);
  }

  if (toAccount.user_id) {
    await createNotification(
      c.env.DB,
      toAccount.user_id,
      `You received ₹${body.amount.toFixed(2)} from ${user.id}`,
      'credit'
    );
  }

  await logAudit(c.env.DB, user.id, 'EXTERNAL_TRANSFER', 'transaction', txId,
    `₹${body.amount} to payee ${payee.payee_name}`);

  const tx = await c.env.DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(txId).first<Transaction>();
  return c.json({ transaction: tx }, 201);
});

transfers.post('/request', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    to_account_id: string;
    from_user_id: string;
    amount: number;
    description?: string;
    idempotency_key: string;
  }>();

  if (!body.idempotency_key) {
    return c.json({ error: 'Idempotency key is required' }, 400);
  }

  if (!body.to_account_id || !body.from_user_id || !body.amount) {
    return c.json({ error: 'To account, from user ID, and amount are required' }, 400);
  }

  if (body.amount <= 0) {
    return c.json({ error: 'Amount must be positive' }, 400);
  }

  const existing = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE idempotency_key = ?'
  ).bind(body.idempotency_key).first<Transaction>();

  if (existing) {
    return c.json({ transaction: existing, message: 'Duplicate request' });
  }

  const toAccount = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(body.to_account_id, user.id).first<Account>();

  if (!toAccount) {
    return c.json({ error: 'Receiving account not found' }, 404);
  }

  const fromUser = await c.env.DB.prepare(
    'SELECT id, full_name FROM users WHERE id = ?'
  ).bind(body.from_user_id).first<{ id: string; full_name: string }>();

  if (!fromUser) {
    return c.json({ error: 'Requested user not found' }, 404);
  }

  const amountPaise = Math.round(body.amount * 100);
  const txId = generateId();

  await c.env.DB.prepare(
    `INSERT INTO transactions (id, idempotency_key, from_account_id, to_account_id, amount, type, status, description, created_by)
     VALUES (?, ?, NULL, ?, ?, 'money_request', 'pending', ?, ?)`
  ).bind(txId, body.idempotency_key, body.to_account_id, amountPaise,
    body.description || `Money request from ${user.id}`, user.id).run();

  await createNotification(
    c.env.DB,
    body.from_user_id,
    `${user.id} has requested ₹${body.amount.toFixed(2)} from you. Transaction: ${txId}`,
    'request'
  );

  await logAudit(c.env.DB, user.id, 'MONEY_REQUEST', 'transaction', txId,
    `₹${body.amount} requested from ${body.from_user_id}`);

  const tx = await c.env.DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(txId).first<Transaction>();
  return c.json({ transaction: tx }, 201);
});

export default transfers;
