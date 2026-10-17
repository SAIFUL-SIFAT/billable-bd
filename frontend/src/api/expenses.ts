import api from './axios';

export interface ExpenseData {
  id: number;
  category: string;
  description: string;
  amount: string;
  currency: string;
  amount_bdt: string;
  date: string;
  created_at: string;
}

export interface ExpenseCreatePayload {
  category: string;
  description: string;
  amount: string | number;
  currency: string;
  amount_bdt: string | number;
  date: string;
}

export const expensesApi = {
  getExpenses: async (): Promise<ExpenseData[]> => {
    const res = await api.get<{ results: ExpenseData[] } | ExpenseData[]>('/billing/expenses/');
    if (Array.isArray(res.data)) return res.data;
    return res.data.results || [];
  },

  createExpense: async (payload: ExpenseCreatePayload): Promise<ExpenseData> => {
    const res = await api.post<ExpenseData>('/billing/expenses/', payload);
    return res.data;
  },

  deleteExpense: async (id: number): Promise<void> => {
    await api.delete(`/billing/expenses/${id}/`);
  },

  exportCsv: async (): Promise<Blob> => {
    const res = await api.get('/billing/expenses/export-csv/', {
      responseType: 'blob',
    });
    return res.data;
  },
};
