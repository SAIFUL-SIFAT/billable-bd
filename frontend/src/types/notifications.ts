export interface NotificationItem {
    id: number;
    kind: 'invoice_overdue' | 'payment_received' | string;
    message: string;
    invoice: number | null;
    invoice_number: string | null;
    is_read: boolean;
    created_at: string;
}

export interface PublicInvoiceItem {
    id: number;
    description: string;
    quantity: string;
    unit_price: string;
    subtotal: string;
}

export interface PublicInvoice {
    id: number;
    number: string;
    status: string;
    issue_date: string;
    due_date: string;
    currency: string;
    client_name: string;
    client_email: string;
    subtotal: string;
    tax_rate: string;
    tax_amount: string;
    total_amount: string;
    paid_amount: string;
    balance_due: string;
    notes: string;
    items: PublicInvoiceItem[];
}
