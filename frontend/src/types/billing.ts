export interface TimeEntry {
    id: number;
    project: number;
    project_name: string;
    client_name: string;
    date: string;
    hours: string;
    description: string;
    is_billed: boolean;
    created_at: string;
}

export interface TimeEntryTotals {
    total_hours: number;
    unbilled_hours: number;
    unbilled_amount: number;
}

export interface CreateTimeEntryPayload {
    project: number;
    date: string;
    hours: number;
    description?: string;
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'VOID' | 'OVERDUE';

export type PaymentMethod =
    | 'bank_transfer'
    | 'wise'
    | 'payoneer'
    | 'paypal'
    | 'bkash'
    | 'nagad'
    | 'other';

export interface InvoiceItem {
    id?: number;
    time_entry?: number | null;
    description: string;
    quantity: number | string;
    unit_price: number | string;
    subtotal?: number | string;
}

export interface Invoice {
    id: number;
    client: number;
    client_name?: string;
    number: string;
    status: InvoiceStatus;
    issue_date: string;
    due_date: string;
    subtotal: string;
    tax_rate: string;
    tax_amount: string;
    total_amount: string;
    paid_amount: string;
    notes: string;
    items: InvoiceItem[];
    created_at?: string;
}

export interface CreateInvoicePayload {
    client: number;
    issue_date: string;
    due_date: string;
    tax_rate: number | string;
    notes?: string;
    items: {
        description: string;
        quantity: number;
        unit_price: number;
    }[];
}

export interface InvoiceFromTimePayload {
    client: number;
    date_from: string;
    date_to: string;
    project_ids?: number[];
    tax_rate?: number | string;
}

export interface Payment {
    id: number;
    invoice: number;
    amount_applied: string;
    fee_amount: string;
    received_bdt: string;
    method: PaymentMethod;
    paid_on: string;
    reference: string;
    effective_rate: string;
    created_at: string;
}

export interface CreatePaymentPayload {
    amount_applied: number | string;
    fee_amount: number | string;
    received_bdt: number | string;
    method: PaymentMethod;
    paid_on: string;
    reference?: string;
}

