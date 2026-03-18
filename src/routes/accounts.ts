import { Hono } from 'hono';
import type { Env, Account, Transaction, AuthUser } from '../types';
import { authMiddleware } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const accounts = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

accounts.use('*', authMiddleware);

accounts.get('/', async (c) => {
  const user = c.get('user');
  const result = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at ASC'
  ).bind(user.id).all<Account>();
  return c.json({ accounts: result.results });
});

accounts.get('/:id', async (c) => {
  const user = c.get('user');
  const accountId = c.req.param('id');
  const account = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, user.id).first<Account>();

  if (!account) {
    return c.json({ error: 'Account not found' }, 404);
  }
  return c.json({ account });
});

accounts.patch('/:id', async (c) => {
  const user = c.get('user');
  const accountId = c.req.param('id');
  const body = await c.req.json<{ account_name: string }>();

  if (!body.account_name || body.account_name.trim().length === 0) {
    return c.json({ error: 'Account name is required' }, 400);
  }

  const account = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, user.id).first<Account>();

  if (!account) {
    return c.json({ error: 'Account not found' }, 404);
  }

  await c.env.DB.prepare(
    'UPDATE accounts SET account_name = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(body.account_name.trim(), accountId).run();

  await logAudit(c.env.DB, user.id, 'ACCOUNT_RENAMED', 'account', accountId,
    `Renamed from "${account.account_name}" to "${body.account_name.trim()}"`);

  return c.json({ message: 'Account renamed', account_name: body.account_name.trim() });
});

accounts.get('/:id/transactions', async (c) => {
  const user = c.get('user');
  const accountId = c.req.param('id');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const account = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, user.id).first<Account>();

  if (!account) {
    return c.json({ error: 'Account not found' }, 404);
  }

  const txns = await c.env.DB.prepare(
    `SELECT * FROM transactions 
     WHERE from_account_id = ? OR to_account_id = ?
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(accountId, accountId, limit, offset).all<Transaction>();

  const countResult = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM transactions WHERE from_account_id = ? OR to_account_id = ?'
  ).bind(accountId, accountId).first<{ total: number }>();

  return c.json({
    transactions: txns.results,
    pagination: {
      page,
      limit,
      total: countResult?.total ?? 0,
      totalPages: Math.ceil((countResult?.total ?? 0) / limit),
    },
  });
});

accounts.get('/:id/statement', async (c) => {
  const user = c.get('user');
  const accountId = c.req.param('id');

  const account = await c.env.DB.prepare(
    'SELECT * FROM accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, user.id).first<Account>();

  if (!account) {
    return c.json({ error: 'Account not found' }, 404);
  }

  const txns = await c.env.DB.prepare(
    `SELECT * FROM transactions 
     WHERE (from_account_id = ? OR to_account_id = ?) AND status = 'completed'
     ORDER BY created_at DESC`
  ).bind(accountId, accountId).all<Transaction>();

  let statement = `BANK STATEMENT\n`;
  statement += `${'='.repeat(60)}\n`;
  statement += `Account: ${account.account_name} (${account.id})\n`;
  statement += `Type: ${account.account_type.toUpperCase()}\n`;
  statement += `Current Balance: ₹${(account.balance / 100).toFixed(2)}\n`;
  statement += `Generated: ${new Date().toISOString()}\n`;
  statement += `${'='.repeat(60)}\n\n`;
  statement += `${'Date'.padEnd(22)}${'Type'.padEnd(20)}${'Amount'.padEnd(15)}Description\n`;
  statement += `${'-'.repeat(80)}\n`;

  for (const tx of txns.results) {
    const isDebit = tx.from_account_id === accountId;
    const amount = `${isDebit ? '-' : '+'}₹${(tx.amount / 100).toFixed(2)}`;
    const date = tx.created_at.substring(0, 19);
    statement += `${date.padEnd(22)}${tx.type.padEnd(20)}${amount.padEnd(15)}${tx.description || '-'}\n`;
  }

  statement += `\n${'-'.repeat(80)}\n`;
  statement += `End of Statement\n`;

  return new Response(statement, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="statement-${accountId}-${Date.now()}.txt"`,
    },
  });
});

export default accounts;
