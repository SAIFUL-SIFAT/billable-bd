import api from './axios';

export interface ProfileData {
    id: number;
    business_name: string;
    business_address: string;
    tax_number: string;
    tax_rate_presets: number[];
    custom_exchange_rate: string | null;
    logo: string | null;
    logo_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProfileUpdatePayload {
    business_name?: string;
    business_address?: string;
    tax_number?: string;
    tax_rate_presets?: number[];
    custom_exchange_rate?: string | null;
}

export const profileApi = {
    getProfile: async (): Promise<ProfileData> => {
        const res = await api.get<ProfileData>('/accounts/profile/');
        return res.data;
    },

    updateProfile: async (payload: ProfileUpdatePayload): Promise<ProfileData> => {
        const res = await api.patch<ProfileData>('/accounts/profile/', payload);
        return res.data;
    },

    uploadLogo: async (file: File): Promise<ProfileData> => {
        const formData = new FormData();
        formData.append('logo', file);
        const res = await api.patch<ProfileData>('/accounts/profile/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return res.data;
    },

    deleteLogo: async (): Promise<ProfileData> => {
        const res = await api.delete<ProfileData>('/accounts/profile/logo/');
        return res.data;
    },
};
