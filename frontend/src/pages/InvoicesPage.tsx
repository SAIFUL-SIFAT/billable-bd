import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { invoiceApi } from '../api/billing';
import { getClients } from '../api/clients';
import type { Invoice, InvoiceStatus } from '../types/billing';
import type { Client } from '../types/client';
import { formatDate, formatRelativeDue } from '../utils/formatters';
import { Money } from '../components/Money';
import { 
    Search, 
    Plus, 
    Clock, 
    ArrowUpDown, 
    Eye, 
    ChevronLeft, 
    ChevronRight,
    FileText,
    Download
} from 'lucide-react';

export const InvoiceStatusBadge: React.FC<{ status: InvoiceStatus; dueDate?: string }> = ({
    status,
    dueDate,
}) => {
    // Check if overdue: SENT or PARTIALLY_PAID and past the due date (using plain date comparison)
    const isPastDue = (() => {
        if (!dueDate || (status !== 'SENT' && status !== 'PARTIALLY_PAID')) return false;
        const parts = dueDate.split('T')[0].split('-');
        if (parts.length !== 3) return false;
        const due = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return due < today;
    })();

    if (isPastDue || status === 'OVERDUE') {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
                Overdue
            </span>
        );
    }

    switch (status) {
        case 'DRAFT':
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Draft
                </span>
            );
        case 'SENT':
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                    Sent
                </span>
            );
        case 'PARTIALLY_PAID':
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                    Partially Paid
                </span>
            );
        case 'PAID':
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                    Paid
                </span>
            );
        case 'VOID':
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 line-through border border-slate-200">
                    Void
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    {status}
                </span>
            );
    }
};

type SortField = 'issue_date' | 'due_date' | 'total_amount';
type SortOrder = 'asc' | 'desc';

export const InvoicesPage: React.FC = () => {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [clientFilter, setClientFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const [count, setCount] = useState<number>(0);
    const [sortField, setSortField] = useState<SortField>('issue_date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const pageSize = 20;

    // Load clients
    useEffect(() => {
        const loadClients = async (): Promise<void> => {
            try {
                const res = await getClients();
                setClients(res.results || []);
            } catch (err) {
                console.error('Failed to load clients', err);
            }
        };
        loadClients();
    }, []);

    // Fetch invoices
    const fetchInvoices = async (): Promise<void> => {
        setLoading(true);
        try {
            const params: Record<string, any> = { page };
            if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'OVERDUE') {
                params.status = statusFilter;
            }
            if (clientFilter) params.client = clientFilter;
            if (searchQuery.trim()) params.search = searchQuery.trim();

            const orderingPrefix = sortOrder === 'desc' ? '-' : '';
            params.ordering = `${orderingPrefix}${sortField}`;

            const res = await invoiceApi.getInvoices(params);
            let items = res.results || [];

            // If client-side overdue tab is active
            if (statusFilter === 'OVERDUE') {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                items = items.filter((inv) => {
                    if (inv.status !== 'SENT' && inv.status !== 'PARTIALLY_PAID') return false;
                    const parts = inv.due_date.split('T')[0].split('-');
                    if (parts.length !== 3) return false;
                    const due = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                    return due < today;
                });
            }

            setInvoices(items);
            setCount(res.count || 0);
        } catch (err) {
            console.error('Failed to fetch invoices', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, [statusFilter, clientFilter, searchQuery, page, sortField, sortOrder]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
        setPage(1);
    };

    const totalPages = Math.ceil(count / pageSize) || 1;

    const statusTabs = [
        { id: 'ALL', label: 'All Invoices' },
        { id: 'DRAFT', label: 'Draft' },
        { id: 'SENT', label: 'Sent' },
        { id: 'PARTIALLY_PAID', label: 'Partially Paid' },
        { id: 'OVERDUE', label: 'Overdue' },
        { id: 'PAID', label: 'Paid' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices</h1>
                    <p className="text-sm text-slate-600 mt-1">
                        Manage draft billing, track receivables in client currencies, and record payments.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                const blob = await invoiceApi.exportCsv();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'invoices.csv';
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                            } catch (err) {
                                console.error('Failed to export invoices CSV', err);
                            }
                        }}
                        className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all"
                    >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span>Export CSV</span>
                    </button>
                    <Link
                        to="/invoices/from-time"
                        className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all text-center"
                    >
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Unbilled Time</span>
                    </Link>
                    <Link
                        to="/invoices/new"
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-xs hover:shadow transition-all active:scale-[0.99]"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Invoice</span>
                    </Link>
                </div>
            </div>


            {/* Compact Status Tabs */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 border-b border-slate-200">
                {statusTabs.map((tab) => {
                    const isActive = statusFilter === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setStatusFilter(tab.id);
                                setPage(1);
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                isActive
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Slim Filter Toolbar */}
            <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        id="search"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Search invoice number, client..."
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all"
                    />
                </div>

                <div className="w-full md:w-64">
                    <select
                        id="client"
                        value={clientFilter}
                        onChange={(e) => {
                            setClientFilter(e.target.value);
                            setPage(1);
                        }}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none transition-all"
                    >
                        <option value="">All Clients</option>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} {c.company ? `(${c.company})` : ''} - {c.default_currency}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-600 text-sm flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                        <span>Loading invoices...</span>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-600 text-sm">No invoices found matching your criteria.</p>
                        <Link
                            to="/invoices/new"
                            className="inline-block mt-3 text-amber-600 hover:text-amber-700 text-xs font-semibold"
                        >
                            Create a new invoice &rarr;
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3.5 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">
                                        Invoice #
                                    </th>
                                    <th className="px-6 py-3.5 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">
                                        Client
                                    </th>
                                    <th 
                                        onClick={() => handleSort('issue_date')}
                                        className="px-6 py-3.5 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs cursor-pointer hover:text-slate-900 select-none"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Dates</span>
                                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('total_amount')}
                                        className="px-6 py-3.5 text-right font-semibold text-slate-600 uppercase tracking-wider text-xs cursor-pointer hover:text-slate-900 select-none"
                                    >
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Total Amount</span>
                                            <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3.5 text-right font-semibold text-slate-600 uppercase tracking-wider text-xs">
                                        Balance Due
                                    </th>
                                    <th className="px-6 py-3.5 text-center font-semibold text-slate-600 uppercase tracking-wider text-xs">
                                        Status
                                    </th>
                                    <th className="px-6 py-3.5 text-right font-semibold text-slate-600 uppercase tracking-wider text-xs">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {invoices.map((inv) => {
                                    const invoiceCurrency = inv.currency || 'USD';
                                    const balanceDue = Math.max(
                                        0,
                                        parseFloat(inv.total_amount) - parseFloat(inv.paid_amount || '0')
                                    );
                                    const relativeDue = formatRelativeDue(inv.due_date, inv.status);

                                    return (
                                        <tr
                                            key={inv.id}
                                            onClick={() => navigate(`/invoices/${inv.id}`)}
                                            className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-900 font-mono text-xs">
                                                {inv.number ? inv.number : <span className="text-slate-400 italic font-sans">Draft #{inv.id}</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-800 font-medium text-xs">
                                                {inv.client_name || `Client #${inv.client}`}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-600 text-xs">
                                                <div>Issued: {formatDate(inv.issue_date)}</div>
                                                <div className="text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                    <span>Due: {formatDate(inv.due_date)}</span>
                                                    {relativeDue && (
                                                        <span className={`text-[11px] font-medium px-1.5 py-0.2 rounded ${
                                                            relativeDue.includes('overdue') 
                                                                ? 'bg-rose-50 text-rose-700 font-semibold' 
                                                                : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                            {relativeDue}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <Money amount={inv.total_amount} currency={invoiceCurrency} numberClassName="text-xs font-semibold text-slate-900" />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                                                {balanceDue > 0 ? (
                                                    <Money 
                                                        amount={balanceDue.toFixed(2)} 
                                                        currency={invoiceCurrency} 
                                                        numberClassName="text-xs font-semibold text-slate-900" 
                                                    />
                                                ) : (
                                                    <span className="text-emerald-700 font-medium">Paid in full</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <InvoiceStatusBadge status={inv.status} dueDate={inv.due_date} />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                                                <Link
                                                    to={`/invoices/${inv.id}`}
                                                    className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-semibold text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>View</span>
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
                        <div className="text-xs text-slate-600 font-medium">
                            Showing page {page} of {totalPages} ({count} total invoices)
                        </div>
                        <div className="flex space-x-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-100 shadow-sm transition-all"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Previous</span>
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-100 shadow-sm transition-all"
                            >
                                <span>Next</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
