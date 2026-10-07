export type Currency = 'BDT' | 'USD' | 'EUR' | 'GBP';
export type BillingType = 'hourly' | 'fixed';

export interface Client {
    id: number;
    name: string;
    email: string;
    company: string;
    country: string;
    default_currency: Currency;
    address: string;
    notes: string;
    created_at: string;
}

export interface Project {
    id: number;
    client: number;
    client_name?: string;
    name: string;
    billing_type: BillingType;
    currency: Currency;
    hourly_rate: string | null;
    fixed_price: string | null;
    is_archived: boolean;
    created_at: string;
}

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}