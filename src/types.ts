export interface Env {
  DB: D1Database;
  SESSION_SECRET: string;
  ASSETS: Fetcher;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'user' | 'admin';
  is_frozen: number;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  account_name: string;
  account_type: 'checking' | 'savings';
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface Payee {
  id: string;
  user_id: string;
  payee_name: string;
  payee_user_id: string | null;
  payee_account_id: string | null;
  nickname: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  idempotency_key: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  type: 'internal_transfer' | 'external_transfer' | 'money_request' | 'reversal';
  status: 'pending' | 'completed' | 'failed';
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  is_read: number;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  is_frozen: number;
}
