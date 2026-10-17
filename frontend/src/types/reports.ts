export interface MonthlyIncomePoint {
    month: string; // "YYYY-MM"
    amount: string; // Formatted decimal string (e.g. "118000.00")
}

export interface CurrencyAmount {
    currency: string;
    amount: string;
}

export interface InvoicedCurrencyAmount {
    currency: string;
    total: string;
}

export interface FeeByMethod {
    currency: string;
    method: string;
    total: string;
}

export interface FeeThisMonth {
    currency: string;
    total: string;
}

export interface GrossVsNetRow {
    currency: string;
    applied: string;
    fees: string;
    fee_percentage: string;
    received_bdt: string;
    weighted_rate: string | null;
}

export interface TopClient {
    client_id: number;
    client_name: string;
    received_bdt: string;
}

export interface RatesData {
    base: string;
    rates: Record<string, number>;
    source: string;
    playground_url: string;
}

export interface DashboardData {
    income_bdt_this_month: string;
    monthly_income_bdt: MonthlyIncomePoint[];
    outstanding_by_currency: CurrencyAmount[];
    estimated_outstanding_bdt?: string;
    user_custom_rate?: string | null;
    overdue_by_currency: CurrencyAmount[];
    fees_by_method: FeeByMethod[];
    fees_this_month?: FeeThisMonth[];
    gross_vs_net?: GrossVsNetRow[];
    top_clients: TopClient[];
    exchange_rates_info?: {
        source?: string;
        playground_url?: string;
        rates?: Record<string, number>;
    };
}

export interface MonthlyBdtBreakdown {
    month: string; // "YYYY-MM"
    received_bdt: string;
}

export interface EffectiveRateSummary {
    currency: string;
    applied: string;
    fees: string;
    fee_percentage: string;
    received_bdt: string;
    average_effective_rate: string | null;
}

export interface FiscalYearReportData {
    fy: string;
    received_bdt: string;
    total_expenses_bdt?: string;
    net_profit_bdt?: string;
    invoiced_by_currency: InvoicedCurrencyAmount[];
    fees_by_currency: InvoicedCurrencyAmount[];
    monthly_received_bdt?: MonthlyBdtBreakdown[];
    currency_performance?: EffectiveRateSummary[];
}
