import { Hono } from 'hono';
import type { Env, AuthUser, User, Transaction, Account } from '../types';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { generateId } from '../utils/crypto';
import { logAudit, createNotification } from '../utils/audit';

const admin = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

admin.use('*', authMiddleware);
admin.use('*', adminMiddleware);

admin.get('/liquidity', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT SUM(balance) as total_balance, COUNT(*) as total_accounts FROM accounts'
  ).first<{ total_balance: number; total_accounts: number }>();

  const userCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM users'
  ).first<{ total: number }>();

  return c.json({
    total_liquidity: result?.total_balance ?? 0,
    total_liquidity_rupees: ((result?.total_balance ?? 0) / 100).toFixed(2),
    total_accounts: result?.total_accounts ?? 0,
    total_users: userCount?.total ?? 0,
  });
});

admin.get('/users', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const users = await c.env.DB.prepare(
    `SELECT id, email, full_name, role, is_frozen, failed_login_attempts, locked_until, created_at, updated_at
     FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  const countResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM users'
  ).first<{ total: number }>();

  return c.json({
    users: users.results,
    pagination: {
      page, limit,
      total: countResult?.total ?? 0,
      totalPages: Math.ceil((countResult?.total ?? 0) / limit),
    },
  });
});

admin.post('/users/:id/freeze', async (c) => {
  const adminUser = c.get('user');
  const userId = c.req.param('id');
  const body = await c.req.json<{ frozen: boolean }>();

  const targetUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId).first<User>();

  if (!targetUser) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (targetUser.role === 'admin') {
    return c.json({ error: 'Cannot freeze admin accounts' }, 400);
  }

  await c.env.DB.prepare(
    'UPDATE users SET is_frozen = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(body.frozen ? 1 : 0, userId).run();

  await logAudit(c.env.DB, adminUser.id, body.frozen ? 'USER_FROZEN' : 'USER_UNFROZEN',
    'user', userId, `Admin ${adminUser.id} ${body.frozen ? 'froze' : 'unfroze'} user ${userId}`);

  return c.json({ message: `User ${body.frozen ? 'frozen' : 'unfrozen'}` });
});

admin.post('/transactions/:id/reverse', async (c) => {
  const adminUser = c.get('user');
  const txId = c.req.param('id');

  const tx = await c.env.DB.prepare('SELECT * FROM transactions WHERE id = ?')
    .bind(txId).first<Transaction>();

  if (!tx) {
    return c.json({ error: 'Transaction not found' }, 404);
  }

  if (tx.status !== 'completed') {
    return c.json({ error: 'Only completed transactions can be reversed' }, 400);
  }

  if (tx.type === 'reversal') {
    return c.json({ error: 'Cannot reverse a reversal' }, 400);
  }

  if (!tx.from_account_id || !tx.to_account_id) {
    return c.json({ error: 'Transaction missing account references' }, 400);
  }

  const toAccount = await c.env.DB.prepare('SELECT * FROM accounts WHERE id = ?')
    .bind(tx.to_account_id).first<Account>();

  if (!toAccount || toAccount.balance < tx.amount) {
    return c.json({ error: 'Insufficient funds in recipient account for reversal' }, 400);
  }

  const reversalId = generateId();

  const batch = [
    c.env.DB.prepare(
      'UPDATE accounts SET balance = balance + ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(tx.amount, tx.from_account_id),
    c.env.DB.prepare(
      'UPDATE accounts SET balance = balance - ?, updated_at = datetime(\'now\') WHERE id = ? AND balance >= ?'
    ).bind(tx.amount, tx.to_account_id, tx.amount),
    c.env.DB.prepare(
      `UPDATE transactions SET status = 'failed', updated_at = datetime('now') WHERE id = ?`
    ).bind(txId),
    c.env.DB.prepare(
      `INSERT INTO transactions (id, from_account_id, to_account_id, amount, type, status, description, created_by)
       VALUES (?, ?, ?, ?, 'reversal', 'completed', ?, ?)`
    ).bind(reversalId, tx.to_account_id, tx.from_account_id, tx.amount,
      `Reversal of transaction ${txId}`, adminUser.id),
  ];

  await c.env.DB.batch(batch);

  if (toAccount.user_id) {
    await createNotification(c.env.DB, toAccount.user_id,
      `Transaction ${txId} of ₹${(tx.amount / 100).toFixed(2)} has been reversed by admin.`, 'reversal');
  }

  const fromAccount = await c.env.DB.prepare('SELECT user_id FROM accounts WHERE id = ?')
    .bind(tx.from_account_id).first<{ user_id: string }>();
  if (fromAccount) {
    await createNotification(c.env.DB, fromAccount.user_id,
      `₹${(tx.amount / 100).toFixed(2)} has been refunded to your account (reversal of ${txId}).`, 'reversal');
  }

  await logAudit(c.env.DB, adminUser.id, 'TRANSACTION_REVERSED', 'transaction', txId,
    `Reversed ₹${(tx.amount / 100).toFixed(2)}, reversal ID: ${reversalId}`);

  return c.json({ message: 'Transaction reversed', reversal_id: reversalId });
});

admin.get('/audit-log', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = (page - 1) * limit;

  const logs = await c.env.DB.prepare(
    'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all();

  const countResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM audit_log'
  ).first<{ total: number }>();

  return c.json({
    audit_log: logs.results,
    pagination: {
      page, limit,
      total: countResult?.total ?? 0,
      totalPages: Math.ceil((countResult?.total ?? 0) / limit),
    },
  });
});

admin.get('/transactions', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = (page - 1) * limit;

  const txns = await c.env.DB.prepare(
    'SELECT * FROM transactions ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all();

  const countResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM transactions'
  ).first<{ total: number }>();

  return c.json({
    transactions: txns.results,
    pagination: {
      page, limit,
      total: countResult?.total ?? 0,
      totalPages: Math.ceil((countResult?.total ?? 0) / limit),
    },
  });
});

export default admin;
