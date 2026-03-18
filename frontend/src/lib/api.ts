const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((data as any).error || `HTTP ${res.status}`);
  }

  if (res.headers.get('content-type')?.includes('text/plain')) {
    return res.text() as any;
  }

  return res.json();
}

export const api = {
  auth: {
    register: (data: { email: string; password: string; full_name: string }) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: any }>('/auth/me'),
  },
  accounts: {
    list: () => request<{ accounts: any[] }>('/accounts'),
    get: (id: string) => request<{ account: any }>(`/accounts/${id}`),
    rename: (id: string, account_name: string) =>
      request(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify({ account_name }) }),
    transactions: (id: string, page = 1) =>
      request<{ transactions: any[]; pagination: any }>(`/accounts/${id}/transactions?page=${page}`),
    statement: async (id: string) => {
      const res = await fetch(`${BASE}/accounts/${id}/statement`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to download statement');
      return res.text();
    },
  },
  users: {
    lookup: (id: string) =>
      request<{ user_id: string; full_name: string; checking_account_id: string | null }>(`/users/${id}/lookup`),
  },
  payees: {
    list: () => request<{ payees: any[] }>('/payees'),
    create: (data: any) => request('/payees', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request(`/payees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/payees/${id}`, { method: 'DELETE' }),
  },
  transfers: {
    internal: (data: any) =>
      request('/transfers/internal', { method: 'POST', body: JSON.stringify(data) }),
    external: (data: any) =>
      request('/transfers/external', { method: 'POST', body: JSON.stringify(data) }),
    requestMoney: (data: any) =>
      request('/transfers/request', { method: 'POST', body: JSON.stringify(data) }),
  },
  notifications: {
    list: () => request<{ notifications: any[] }>('/notifications'),
    unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
    markRead: (id: string) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => request('/notifications/read-all', { method: 'POST' }),
  },
  admin: {
    liquidity: () => request<any>('/admin/liquidity'),
    users: (page = 1) => request<{ users: any[]; pagination: any }>(`/admin/users?page=${page}`),
    userAccounts: (id: string) => request<{ accounts: any[] }>(`/admin/users/${id}/accounts`),
    freezeUser: (id: string, frozen: boolean) =>
      request(`/admin/users/${id}/freeze`, { method: 'POST', body: JSON.stringify({ frozen }) }),
    transactions: (page = 1) =>
      request<{ transactions: any[]; pagination: any }>(`/admin/transactions?page=${page}`),
    reverseTransaction: (id: string) =>
      request(`/admin/transactions/${id}/reverse`, { method: 'POST' }),
    auditLog: (page = 1) =>
      request<{ audit_log: any[]; pagination: any }>(`/admin/audit-log?page=${page}`),
  },
};
