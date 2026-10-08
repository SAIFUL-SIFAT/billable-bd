import api from './axios';
import type { TimeEntry, TimeEntryTotals, CreateTimeEntryPayload } from '../types/billing';
import type { PaginatedResponse } from '../types/client';

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
