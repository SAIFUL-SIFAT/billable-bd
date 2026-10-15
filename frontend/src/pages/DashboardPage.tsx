import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Cell,
} from 'recharts';
import { reportsApi } from '../api/reports';
import { billingApi } from '../api/billing';
import type { DashboardData } from '../types/reports';
import type { TimeEntryTotals } from '../types/billing';
import { Money } from '../components/Money';
import { 
    Clock, 
    ArrowUpRight, 
    ChevronRight, 
    AlertCircle, 
    TrendingUp, 
    Calculator,
    Info
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [unbilledTotals, setUnbilledTotals] = useState<TimeEntryTotals | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // User-set manual exchange rate for estimation (defaults to average effective rate or 122.50)
    const [manualRate, setManualRate] = useState<string>('122.50');
    const [convertAmount, setConvertAmount] = useState<string>('100');
    const [convertCurrency, setConvertCurrency] = useState<string>('USD');

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true);
                setError(null);
                const [dashResult, totalsResult] = await Promise.all([
                    reportsApi.getDashboard(),
                    billingApi.getTotals().catch(() => null),
                ]);
                setData(dashResult);
                if (totalsResult) setUnbilledTotals(totalsResult);

                // If user has recorded USD gross vs net, default the rate to their own weighted rate
                if (dashResult?.gross_vs_net) {
                    const usdRow = dashResult.gross_vs_net.find((r) => r.currency === 'USD');
                    if (usdRow?.weighted_rate) {
                        setManualRate(usdRow.weighted_rate);
                    }
                }
            } catch (err: any) {
                setError(err.response?.data?.detail || 'Failed to load dashboard metrics.');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 gap-2 text-sm text-slate-600">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                <span>Loading financial overview...</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="rounded-2xl bg-rose-50 p-6 border border-rose-200">
                <div className="text-sm text-rose-700 font-semibold">{error || 'Unable to display dashboard.'}</div>
            </div>
        );
    }

    // Format monthly income chart data: "2026-05" -> "May 2026"
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = data.monthly_income_bdt.map((point) => {
        const parts = point.month.split('-');
        const monthNum = parseInt(parts[1], 10);
        const label = `${monthNames[monthNum - 1]} ${parts[0]}`;
        const amt = parseFloat(point.amount) || 0;
        return {
            monthKey: point.month,
            label,
            amount: amt,
            isCurrent: point.month === currentMonthKey,
        };
    });

    // Lakh formatter helper for Y-axis (e.g. 120000 -> ৳1.2L)
    const formatYAxisLakh = (value: number) => {
        if (value === 0) return '৳0';
        if (value >= 10000000) return `৳${(value / 10000000).toFixed(1)}Cr`;
        if (value >= 100000) return `৳${(value / 100000).toFixed(1)}L`;
        if (value >= 1000) return `৳${(value / 1000).toFixed(0)}k`;
        return `৳${value}`;
    };

    // Total received BDT for top clients share-of-total
    const totalTopClientsBdt = data.top_clients.reduce((acc, c) => acc + (parseFloat(c.received_bdt) || 0), 0);

    return (
        <div className="space-y-8">
            {/* Header with Title and Fiscal Year Report Quick Link */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
                    <p className="text-sm text-slate-600 mt-1">
                        Multi-currency financial overview, realized remittances, and payment fee deductions.
                    </p>
                </div>
                <Link
                    to="/reports/fiscal-year"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl shadow-xs text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 transition-all"
                >
                    <span>Fiscal Year Summary</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
                </Link>
            </div>

            {/* Unbilled Time Callout Banner */}
            {unbilledTotals && unbilledTotals.unbilled_hours > 0 && (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-900">
                                {unbilledTotals.unbilled_hours} hrs unbilled work logged
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                                {unbilledTotals.unbilled_by_currency && unbilledTotals.unbilled_by_currency.length > 0 ? (
                                    <span>
                                        Unbilled value: {unbilledTotals.unbilled_by_currency.map((c) => `${c.currency} ${parseFloat(c.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`).join(' • ')}
                                    </span>
                                ) : (
                                    <span>Ready to be bundled into an invoice for your client</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <Link
                        to="/invoices/from-time"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                    >
                        <span>Create invoice from unbilled time</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            )}

            {/* Equal-Height KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Card 1: BDT This Month */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-44">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Income This Month</div>
                        <div className="mt-2">
                            <Money 
                                amount={data.income_bdt_this_month} 
                                currency="BDT" 
                                numberClassName="text-2xl font-extrabold text-emerald-700" 
                            />
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 font-medium pt-3 border-t border-slate-100 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Credited in Bangladeshi Taka</span>
                    </div>
                </div>

                {/* Card 2: Unpaid Invoices (Stacked per-currency amounts) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-44">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unpaid Invoices</div>
                        <div className="mt-2 space-y-1 overflow-y-auto max-h-16 pr-1">
                            {data.outstanding_by_currency.length === 0 ? (
                                <div className="text-sm font-semibold text-slate-500">No unpaid balances</div>
                            ) : (
                                data.outstanding_by_currency.map((c) => (
                                    <div key={c.currency} className="flex items-center justify-between">
                                        <Money 
                                            amount={c.amount} 
                                            currency={c.currency} 
                                            numberClassName="text-base font-bold text-slate-900" 
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span>Status:</span>
                        <span className="font-semibold text-slate-700">Awaiting client payment</span>
                    </div>
                </div>

                {/* Card 3: Overdue Card (Clickable link to /invoices?status=overdue) */}
                <Link
                    to="/invoices?status=overdue"
                    className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-rose-300 hover:shadow-md transition-all flex flex-col justify-between h-44 group"
                >
                    <div>
                        <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overdue Balance</div>
                            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition" />
                        </div>
                        <div className="mt-2 space-y-1 overflow-y-auto max-h-16 pr-1">
                            {data.overdue_by_currency.length === 0 ? (
                                <div className="text-sm font-semibold text-emerald-700">All invoices within terms</div>
                            ) : (
                                data.overdue_by_currency.map((c) => (
                                    <div key={c.currency} className="flex items-center justify-between">
                                        <Money 
                                            amount={c.amount} 
                                            currency={c.currency} 
                                            numberClassName="text-base font-bold text-rose-700" 
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="text-xs text-rose-700 font-semibold pt-3 border-t border-slate-100 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>View overdue invoices &rarr;</span>
                    </div>
                </Link>

                {/* Card 4: Fees this month (Period labeled) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between h-44">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fees This Month</div>
                        <div className="mt-2 space-y-1 overflow-y-auto max-h-16 pr-1">
                            {(!data.fees_this_month || data.fees_this_month.length === 0) ? (
                                <div className="text-sm font-semibold text-slate-500">৳0.00 logged fees</div>
                            ) : (
                                data.fees_this_month.map((f) => (
                                    <div key={f.currency}>
                                        <Money 
                                            amount={f.total} 
                                            currency={f.currency} 
                                            numberClassName="text-base font-bold text-amber-700" 
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span>Period:</span>
                        <span className="font-semibold text-slate-700">Current calendar month</span>
                    </div>
                </div>
            </div>

            {/* Gross vs Net Performance Story (Realized Remittance Table) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 tracking-tight">
                            Realized Remittance: Gross vs. Net Realization
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                            Invoiced vs gateway fees vs actual credited BDT and your effective exchange rate.
                        </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                        Multi-Currency Analysis
                    </span>
                </div>

                {(!data.gross_vs_net || data.gross_vs_net.length === 0) ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                        No payment remittances recorded yet. Once payments are recorded, your gross vs net story will appear here.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Currency
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Applied (Gross)
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Gateway Fees
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Net Credited (BDT)
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Weighted Effective Rate
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {data.gross_vs_net.map((row) => (
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
                                            {row.weighted_rate ? (
                                                <span className="text-slate-900">৳{row.weighted_rate} / {row.currency}</span>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 6-Month Income Trend Chart (Recharts with Lakh Y-axis and Emerald Current Month) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 tracking-tight">6-Month BDT Income Trend</h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                            Continuous monthly revenue credited in Bangladeshi Taka (current month in emerald).
                        </p>
                    </div>
                </div>

                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="label"
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={{ stroke: '#e2e8f0' }}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={{ stroke: '#e2e8f0' }}
                                tickFormatter={formatYAxisLakh}
                            />
                            <Tooltip
                                formatter={(value: any) => [
                                    <Money amount={Number(value) || 0} currency="BDT" numberClassName="font-bold text-slate-900" />,
                                    'Credited BDT'
                                ]}
                                labelFormatter={(label) => `Month: ${label}`}
                                contentStyle={{
                                    backgroundColor: '#ffffff',
                                    borderColor: '#e2e8f0',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                }}
                            />
                            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={44}>
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.isCurrent ? '#059669' : '#0f172a'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Clients with Share-of-Total Progress Bars */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 tracking-tight">Top Clients (Current Fiscal Year)</h2>
                        <p className="text-xs text-slate-600 mt-0.5">Ranked by total BDT payments credited with share-of-total representation</p>
                    </div>
                </div>

                {data.top_clients.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">No client payments received in this fiscal year.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-2.5 font-semibold text-slate-600 uppercase text-xs">Rank</th>
                                    <th className="px-4 py-2.5 font-semibold text-slate-600 uppercase text-xs">Client Name</th>
                                    <th className="px-4 py-2.5 font-semibold text-slate-600 uppercase text-xs w-48">Share of Revenue</th>
                                    <th className="px-4 py-2.5 font-semibold text-slate-600 uppercase text-xs text-right">Received BDT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {data.top_clients.map((client, index) => {
                                    const clientBdt = parseFloat(client.received_bdt) || 0;
                                    const sharePct = totalTopClientsBdt > 0 ? ((clientBdt / totalTopClientsBdt) * 100).toFixed(1) : '0';

                                    return (
                                        <tr key={client.client_id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-4 py-3 font-bold text-slate-500 text-xs">#{index + 1}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-900 text-xs">{client.client_name}</td>
                                            <td className="px-4 py-3">
                                                <div className="w-full flex items-center gap-2">
                                                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                                        <div 
                                                            className="bg-emerald-600 h-2 rounded-full" 
                                                            style={{ width: `${sharePct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-slate-600 w-9 text-right font-mono">
                                                        {sharePct}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Money amount={client.received_bdt} currency="BDT" numberClassName="text-xs font-bold text-emerald-700" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Compact Currency Conversion Calculator with Clear Estimate Label */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-amber-500" />
                        <h2 className="text-sm font-bold text-slate-900">Currency Estimate Calculator</h2>
                        <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded-md">
                            Estimate Only
                        </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span>Based on your user-defined exchange rate</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                            Amount
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={convertAmount}
                            onChange={(e) => setConvertAmount(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                            Currency
                        </label>
                        <select
                            value={convertCurrency}
                            onChange={(e) => setConvertCurrency(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        >
                            <option value="USD">USD - US Dollar</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="GBP">GBP - British Pound</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                            User Rate (BDT / {convertCurrency})
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={manualRate}
                            onChange={(e) => setManualRate(e.target.value)}
                            placeholder="e.g. 122.50"
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                        />
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                        <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Estimated BDT</div>
                        <div className="text-base font-extrabold text-emerald-700 mt-0.5 truncate font-mono">
                            {(() => {
                                const amt = parseFloat(convertAmount) || 0;
                                const rate = parseFloat(manualRate) || 0;
                                const result = amt * rate;
                                return <Money amount={result.toFixed(2)} currency="BDT" />;
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
