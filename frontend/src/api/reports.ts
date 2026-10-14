import api from './axios';
import type { DashboardData, FiscalYearReportData, RatesData } from '../types/reports';

export const reportsApi = {

    getDashboard: async (): Promise<DashboardData> => {
        const response = await api.get<DashboardData>('/dashboard/');
        return response.data;
    },


    getFiscalYearReport: async (fy?: string): Promise<FiscalYearReportData> => {
        const response = await api.get<FiscalYearReportData>('/reports/fiscal-year/', {
            params: fy ? { fy } : undefined,
        });
        return response.data;
    },

    getRates: async (base: string = 'USD'): Promise<RatesData> => {
        const response = await api.get<RatesData>('/rates/', {
            params: { base },
        });
        return response.data;
    },
};
