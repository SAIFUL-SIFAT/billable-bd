import api from './axios';
import type { TimeEntry, TimeEntryTotals, CreateTimeEntryPayload } from '../types/billing';
import type { PaginatedResponse } from '../types/client';
import type {
    Invoice,
    CreateInvoicePayload,
    InvoiceFromTimePayload,
    Payment,
    CreatePaymentPayload,
} from '../types/billing';


export const billingApi = {
    getTimeEntries: async (params?: Record<string, any>): Promise<PaginatedResponse<TimeEntry>> => {
        const response = await api.get('/billing/time-entries/', { params });
        return response.data;
    },

    createTimeEntry: async (payload: CreateTimeEntryPayload): Promise<TimeEntry> => {
        const response = await api.post('/billing/time-entries/', payload);
        return response.data;
    },

    deleteTimeEntry: async (id: number): Promise<void> => {
        await api.delete(`/billing/time-entries/${id}/`);
    },

    getTotals: async (params?: Record<string, any>): Promise<TimeEntryTotals> => {
        const response = await api.get('/billing/time-entries/totals/', { params });
        return response.data;
    },
};

export const invoiceApi = {
    getInvoices: async (params?: Record<string, any>): Promise<PaginatedResponse<Invoice>> => {
        const response = await api.get('/billing/invoices/', { params });
        return response.data;
    },

    getInvoice: async (id: number): Promise<Invoice> => {
        const response = await api.get(`/billing/invoices/${id}/`);
        return response.data;
    },

    createInvoice: async (payload: CreateInvoicePayload): Promise<Invoice> => {
        const response = await api.post('/billing/invoices/', payload);
        return response.data;
    },

    updateInvoice: async (id: number, payload: Partial<CreateInvoicePayload>): Promise<Invoice> => {
        const response = await api.patch(`/billing/invoices/${id}/`, payload);
        return response.data;
    },

    deleteInvoice: async (id: number): Promise<void> => {
        await api.delete(`/billing/invoices/${id}/`);
    },

    sendInvoice: async (id: number): Promise<any> => {
        const response = await api.post(`/billing/invoices/${id}/send/`);
        return response.data;
    },

    voidInvoice: async (id: number): Promise<any> => {
        const response = await api.post(`/billing/invoices/${id}/void/`);
        return response.data;
    },

    shareInvoice: async (id: number): Promise<{ token: string; token_version: number }> => {
        const response = await api.post(`/billing/invoices/${id}/share/`);
        return response.data;
    },

    revokePublicLink: async (id: number): Promise<{ detail: string; token_version: number }> => {
        const response = await api.post(`/billing/invoices/${id}/revoke-public-link/`);
        return response.data;
    },

    createInvoiceFromTime: async (payload: InvoiceFromTimePayload): Promise<Invoice> => {
        const response = await api.post('/billing/invoices/from-time/', payload);
        return response.data;
    },

    getPayments: async (invoiceId: number): Promise<Payment[]> => {
        const response = await api.get(`/billing/invoices/${invoiceId}/payments/`);
        return response.data;
    },

    recordPayment: async (invoiceId: number, payload: CreatePaymentPayload): Promise<Payment> => {
        const response = await api.post(`/billing/invoices/${invoiceId}/payments/`, payload);
        return response.data;
    },

    createPayment: async (invoiceId: number, payload: CreatePaymentPayload): Promise<Payment> => {
        const response = await api.post(`/billing/invoices/${invoiceId}/payments/`, payload);
        return response.data;
    },

    deletePayment: async (paymentId: number): Promise<void> => {
        await api.delete(`/billing/payments/${paymentId}/`);
    },

    getPublicInvoice: async (token: string): Promise<any> => {
        const response = await api.get(`/billing/public/invoices/${token}/`);
        return response.data;
    },
};


