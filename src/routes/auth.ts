import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import type { Env, User } from '../types';
import { hashPassword, verifyPassword, generateId, generateToken } from '../utils/crypto';
import { generateUserId, generateAccountNumber } from '../utils/helpers';
import { logAudit } from '../utils/audit';
import { authMiddleware } from '../middleware/auth';

const LOCKOUT_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;
const SESSION_DAYS = 7;
const INITIAL_CHECKING_BALANCE = 100000; // ₹1000 in paise

const auth = new Hono<{ Bindings: Env; Variables: { user: any } }>();

auth.post('/register', async (c) => {
  const body = await c.req.json<{ email: string; password: string; full_name: string }>();
  const { email, password, full_name } = body;

  if (!email || !password || !full_name) {
    return c.json({ error: 'Email, password, and full name are required' }, 400);
  }

  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first();

  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const userId = await generateUserId(full_name, c.env.DB);
  const passwordHash = await hashPassword(password);
  const checkingId = generateAccountNumber();
  const savingsId = generateAccountNumber();

  const batch = [
    c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
    ).bind(userId, email.toLowerCase(), passwordHash, full_name),
    c.env.DB.prepare(
      'INSERT INTO accounts (id, user_id, account_name, account_type, balance) VALUES (?, ?, ?, ?, ?)'
    ).bind(checkingId, userId, 'Primary Checking', 'checking', INITIAL_CHECKING_BALANCE),
    c.env.DB.prepare(
      'INSERT INTO accounts (id, user_id, account_name, account_type, balance) VALUES (?, ?, ?, ?, ?)'
    ).bind(savingsId, userId, 'Primary Savings', 'savings', 0),
  ];

  await c.env.DB.batch(batch);

  await logAudit(c.env.DB, userId, 'USER_REGISTERED', 'user', userId, `New user: ${email}`);

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(generateId(), userId, token, expiresAt).run();

  setCookie(c, 'session_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  return c.json({
    user: { id: userId, email: email.toLowerCase(), full_name, role: 'user' },
    accounts: [
      { id: checkingId, account_name: 'Primary Checking', account_type: 'checking', balance: INITIAL_CHECKING_BALANCE },
      { id: savingsId, account_name: 'Primary Savings', account_type: 'savings', balance: 0 },
    ],
  }, 201);
});

auth.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<User>();

  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    return c.json({
      error: `Account locked due to too many failed attempts. Try again in ${remaining} minutes.`,
    }, 423);
  }

  if (user.is_frozen) {
    return c.json({ error: 'Account is frozen. Contact support.' }, 403);
  }

  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    const attempts = user.failed_login_attempts + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      await c.env.DB.prepare(
        'UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).bind(attempts, lockUntil, user.id).run();
      await logAudit(c.env.DB, user.id, 'ACCOUNT_LOCKED', 'user', user.id, `Locked after ${MAX_FAILED_ATTEMPTS} failed attempts`);
      return c.json({
        error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
      }, 423);
    }
    await c.env.DB.prepare(
      'UPDATE users SET failed_login_attempts = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(attempts, user.id).run();
    return c.json({ error: 'Invalid email or password' }, 401);
  }

  await c.env.DB.prepare(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime(\'now\') WHERE id = ?'
  ).bind(user.id).run();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(generateId(), user.id, token, expiresAt).run();

  setCookie(c, 'session_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });

  await logAudit(c.env.DB, user.id, 'USER_LOGIN', 'user', user.id);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
  });
});

auth.post('/logout', authMiddleware, async (c) => {
  const token = c.req.header('Cookie')?.match(/session_token=([^;]+)/)?.[1];
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }
  deleteCookie(c, 'session_token', { path: '/' });
  return c.json({ message: 'Logged out' });
});

auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({ user });
});

export default auth;
