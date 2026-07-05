const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

function getToken() {
  return localStorage.getItem('splitnest_token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers
    },
    ...options
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export type AuthMember = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  joinedAt: string;
  role?: 'admin' | 'member';
};

export type BootstrapData = {
  currentUserId: string;
  activeGroupId: string;
  members: import('./types').Member[];
  groups: (import('./types').Group & { budgetLimit?: number })[];
  expenses: import('./types').Expense[];
  settledSettlementKeys: string[];
  partialSettlements: { from: string; to: string; amount: number; periodKey: string }[];
  settlementRecords: import('./types').SettlementRecord[];
  activityLogs: import('./types').ActivityLog[];
  notifications: import('./types').Notification[];
  expenseCategories: string[];
  incomeCategories: string[];
};

export type ExpenseDraft = {
  groupId: string;
  title: string;
  description?: string;
  amount: number;
  date: string;
  category: string;
  paidBy: string;
  splitMethod: import('./types').SplitMethod;
  notes?: string;
  participants: import('./types').ParticipantShare[];
};

export const api = {
  health: () => request<{ ok: boolean }>('/health'),
  login: async (username: string, password: string) => {
    const data = await request<{ token: string; member: AuthMember }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem('splitnest_token', data.token);
    return data;
  },
  logout: async () => {
    localStorage.removeItem('splitnest_token');
    return request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  },
  me: () => request<{ member: AuthMember }>('/auth/me'),
  bootstrap: () => request<BootstrapData>('/bootstrap'),
  addMember: (body: { name: string; email?: string; groupId: string; password: string }) =>
    request<{ member: import('./types').Member; log: import('./types').ActivityLog }>('/members', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  removeMember: (memberId: string, body: { groupId: string }) =>
    request<{ ok: boolean; log: import('./types').ActivityLog }>(`/members/${memberId}`, {
      method: 'DELETE',
      body: JSON.stringify(body)
    }),
  addExpense: (draft: ExpenseDraft) =>
    request<{ expense: import('./types').Expense; log: import('./types').ActivityLog; notification: import('./types').Notification }>(
      '/expenses',
      { method: 'POST', body: JSON.stringify(draft) }
    ),
  updateExpense: (expenseId: string, draft: ExpenseDraft) =>
    request<{ expense: import('./types').Expense; log: import('./types').ActivityLog; notification: import('./types').Notification }>(
      `/expenses/${expenseId}`,
      { method: 'PUT', body: JSON.stringify(draft) }
    ),
  duplicateExpense: (expenseId: string) =>
    request<{ expense: import('./types').Expense }>(`/expenses/${expenseId}/duplicate`, { method: 'POST' }),
  deleteExpense: (expenseId: string) => request<{ ok: boolean }>(`/expenses/${expenseId}`, { method: 'DELETE' }),
  settle: (body: { groupId: string; from: string; to: string; amount: number; periodKey: string }) =>
    request<{ settledKey: string; log: import('./types').ActivityLog; notification: import('./types').Notification }>(
      '/settlements/settle',
      { method: 'POST', body: JSON.stringify(body) }
    ),
  partialSettle: (body: { groupId: string; from: string; to: string; amount: number; periodKey: string }) =>
    request<{ partial: import('./types').SettlementRecord; log: import('./types').ActivityLog; notification: import('./types').Notification }>(
      '/settlements/partial',
      { method: 'POST', body: JSON.stringify(body) }
    ),
  addCategory: (body: { name: string; type?: 'expense' | 'income' }) =>
    request<{ category: { id: string; name: string; type: string } }>('/categories', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  updateBudget: (groupId: string, budgetLimit: number) =>
    request<{ group: import('./types').Group & { budgetLimit: number } }>(`/groups/${groupId}/budget`, {
      method: 'PATCH',
      body: JSON.stringify({ budgetLimit })
    })
};
