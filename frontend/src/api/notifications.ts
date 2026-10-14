import api from './axios';
import type { NotificationItem, PublicInvoice } from '../types/notifications';

export const notificationApi = {
    getNotifications: async (params?: { is_read?: boolean; page?: number }): Promise<{ results: NotificationItem[]; count: number }> => {
        const response = await api.get('/notifications/', { params });
        return response.data;
    },

    markRead: async (id: number): Promise<NotificationItem> => {
        const response = await api.post(`/notifications/${id}/read/`);
        return response.data;
    },

    markAllRead: async (): Promise<{ updated: number }> => {
        const response = await api.post('/notifications/read-all/');
        return response.data;
    },
};

export const publicInvoiceApi = {
    getPublicInvoice: async (token: string): Promise<PublicInvoice> => {
        const response = await api.get(`/billing/public/invoices/${token}/`);
        return response.data;
    },
};
