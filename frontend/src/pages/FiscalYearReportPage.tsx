import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '../api/reports';
import type { FiscalYearReportData } from '../types/reports';
import { Money } from '../components/Money';
import { 
    ArrowLeft
} from 'lucide-react';

export const FiscalYearReportPage: React.FC = () => {
    const [selectedFy, setSelectedFy] = useState<string>('2026-27');
    const [report, setReport] = useState<FiscalYearReportData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchReport = async (fyToFetch: string) => {
        try {
            setLoading(true);
            setError(null);
            const data = await reportsApi.getFiscalYearReport(fyToFetch);
            setReport(data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to generate fiscal year summary.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport(selectedFy);
    }, [selectedFy]);

    const quickFiscalYears = ['2026-27', '2025-26', '2024-25'];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatMonthKey = (mKey: string) => {
        const parts = mKey.split('-');
        if (parts.length !== 2) return mKey;
        const m = parseInt(parts[1], 10);
        return `${monthNames[m - 1]} ${parts[0]}`;
    };

    return (
        <div className="space-y-8">
            {/* Header and Fiscal Year Picker */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center space-x-2">
                        <Link to="/" className="text-xs font-semibold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Back to Dashboard</span>
                        </Link>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1.5">Fiscal Year Summary</h1>
                    <p className="text-xs text-slate-600 mt-0.5">
                        Financial performance summary covering the July 1 &ndash; June 30 fiscal cycle.
                    </p>
                </div>

                {/* Fiscal Year Quick Switcher */}
                <div className="flex items-center space-x-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fiscal Year:</span>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        {quickFiscalYears.map((fyOption) => (
                            <button
                                key={fyOption}
                                onClick={() => setSelectedFy(fyOption)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                    selectedFy === fyOption
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {fyOption}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="rounded-2xl bg-rose-50 p-4 border border-rose-200/80">
                    <div className="text-xs text-rose-700 font-medium">{error}</div>
                </div>
            )}

            {/* Loading State */}
            {loading ? (
                <div className="flex justify-center items-center h-64 text-slate-600 text-xs gap-2">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                    <span>Generating fiscal year summary...</span>
                </div>
            ) : report ? (
                <div className="space-y-6">
                    {/* KPI Cards: Realized Revenue, Expenses, and Net Profit (US-24) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                Total Realized Income
                            </div>
                            <div className="mt-2">
                                <Money 
                                    amount={report.received_bdt} 
                                    currency="BDT" 
                                    numberClassName="text-2xl sm:text-3xl font-extrabold text-white" 
                                />
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2">
                                Gross remittances credited in BDT.
                            </p>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                            <div className="text-xs font-bold uppercase tracking-wider text-rose-600">
                                Total Business Expenses
                            </div>
                            <div className="mt-2">
                                <Money 
                                    amount={report.total_expenses_bdt || '0.00'} 
                                    currency="BDT" 
                                    numberClassName="text-2xl sm:text-3xl font-extrabold text-rose-700" 
                                />
                            </div>
                            <p className="text-[11px] text-slate-500 mt-2">
                                Operating tools, subscriptions & fees.
                            </p>
                        </div>

                        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                Net Realized Profit
                            </div>
                            <div className="mt-2">
                                <Money 
                                    amount={report.net_profit_bdt || report.received_bdt} 
                                    currency="BDT" 
                                    numberClassName="text-2xl sm:text-3xl font-extrabold text-emerald-600" 
                                />
                            </div>
                            <p className="text-[11px] text-slate-500 mt-2">
                                Income after deducting recorded expenses.
                            </p>
                        </div>
                    </div>

                    {/* Currency Performance: Average Effective Rate & Fees as % of Gross */}
                    {report.currency_performance && report.currency_performance.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                        Currency Realization & Effective Rates
                                    </h2>
                                    <p className="text-xs text-slate-600 mt-0.5">
                                        Effective BDT realization rate per currency and gateway fees as a percentage of gross.
                                    </p>
                                </div>
                                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                                    FY {report.fy} Performance
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Currency
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Gross Applied
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Fees (% of Gross)
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Received BDT
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                                Avg Effective Rate
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {report.currency_performance.map((row) => (
                                            <tr key={row.currency} className="hover:bg-slate-50/50 transition">
                                                <td className="px-4 py-3 text-xs font-bold text-slate-900">
                                                    <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                                                        {row.currency}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Money amount={row.applied} currency={row.currency} numberClassName="text-xs font-bold text-slate-900" />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Money amount={row.fees} currency={row.currency} numberClassName="text-xs text-amber-700 font-semibold" />
                                                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                                            ({row.fee_percentage}%)
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Money amount={row.received_bdt} currency="BDT" numberClassName="text-xs font-extrabold text-emerald-700" />
                                                </td>
                                                <td className="px-4 py-3 text-right text-xs font-bold text-slate-900 font-mono">
                                                    {row.average_effective_rate ? (
                                                        <span>৳{row.average_effective_rate} / {row.currency}</span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Monthly Received BDT Breakdown */}
                    {report.monthly_received_bdt && report.monthly_received_bdt.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                        Received BDT Per Month
                                    </h2>
                                    <p className="text-xs text-slate-600 mt-0.5">
                                        Monthly net revenue credited to your domestic bank accounts or MFS.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {report.monthly_received_bdt.map((m) => (
                                    <div key={m.month} className="p-3 bg-slate-50/70 border border-slate-200/70 rounded-xl">
                                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            {formatMonthKey(m.month)}
                                        </div>
                                        <div className="mt-1">
                                            <Money 
                                                amount={m.received_bdt} 
                                                currency="BDT" 
                                                numberClassName="text-xs font-bold text-slate-900" 
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Two-Column Breakdown: Invoiced by Currency vs Gateway Fees */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Invoiced Amounts Grouped by Currency */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 tracking-tight">Total Invoiced (Billed)</h2>
                                    <p className="text-xs text-slate-600 mt-0.5">Non-draft, non-void invoices issued in this FY</p>
                                </div>
                                <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-mono font-bold border border-slate-200/60">
                                    FY {report.fy}
                                </span>
                            </div>

                            {report.invoiced_by_currency.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-xs">
                                    No invoices issued during this fiscal year.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {report.invoiced_by_currency.map((item) => (
                                        <div key={item.currency} className="py-3 flex items-center justify-between">
                                            <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-mono text-xs font-bold border border-slate-200/60">
                                                {item.currency}
                                            </span>
                                            <Money amount={item.total} currency={item.currency} numberClassName="text-sm font-bold text-slate-900" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Processor Fees Deducted Grouped by Currency */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <h2 className="text-base font-bold text-slate-900 tracking-tight">Remittance Fees Deducted</h2>
                                    <p className="text-xs text-slate-600 mt-0.5">Processor fees charged on payments in this FY</p>
                                </div>
                                <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-mono font-bold border border-amber-200/60">
                                    FY {report.fy}
                                </span>
                            </div>

                            {report.fees_by_currency.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-xs">
                                    No processing fees logged during this fiscal year.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {report.fees_by_currency.map((item) => (
                                        <div key={item.currency} className="py-3 flex items-center justify-between">
                                            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg font-mono text-xs font-bold border border-amber-200/60">
                                                {item.currency}
                                            </span>
                                            <Money amount={item.total} currency={item.currency} numberClassName="text-sm font-bold text-amber-700" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
