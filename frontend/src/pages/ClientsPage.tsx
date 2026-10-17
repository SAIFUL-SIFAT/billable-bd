import React, { useState, useEffect } from 'react';
import type { Client } from '../types/client';
import { getClients, createClient, deleteClient } from '../api/clients';
import { formatDate } from '../utils/formatters';
import { Money } from '../components/Money';
import { 
    Plus, 
    Search, 
    MoreVertical, 
    Trash2, 
    Building, 
    X
} from 'lucide-react';

export const ClientsPage: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [company, setCompany] = useState('');
    const [currency, setCurrency] = useState<'BDT' | 'USD' | 'EUR' | 'GBP'>('BDT');

    // Menu and delete confirmation modal state
    const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const [deleting, setDeleting] = useState<boolean>(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const fetchClients = async () => {
        setLoading(true);
        try {
            const res = await getClients(search);
            setClients(res.results || []);
        } catch (err) {
            console.error('Failed to load clients', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, [search]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createClient({ name, email, company, default_currency: currency });
            setShowModal(false);
            setName('');
            setEmail('');
            setCompany('');
            fetchClients();
        } catch (err) {
            alert('Error creating client');
        }
    };

    const confirmDelete = async () => {
        if (!clientToDelete) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            await deleteClient(clientToDelete.id);
            setClientToDelete(null);
            fetchClients();
        } catch (err: any) {
            setDeleteError(err.response?.data?.detail || 'Cannot delete client. Ensure no invoices are attached.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clients</h1>
                    <p className="text-sm text-slate-600 mt-1">
                        Monitor client accounts, outstanding multi-currency balances, and lifetime BDT revenue.
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all active:scale-[0.99]"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Client</span>
                </button>
            </div>

            {/* Search Toolbar */}
            <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    placeholder="Search by client name, email, or company..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-xs transition-all"
                />
            </div>

            {/* Clients Grid */}
            {loading ? (
                <div className="flex justify-center items-center py-20 text-slate-600 text-xs gap-2">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                    <span>Loading client directory...</span>
                </div>
            ) : clients.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
                    <Building className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-600 text-sm">No clients found matching your query.</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-block mt-3 text-amber-600 hover:text-amber-700 text-xs font-semibold"
                    >
                        Create your first client &rarr;
                    </button>
                </div>
            ) : (
                <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {clients.map((c) => (
                        <div
                            key={c.id}
                            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group relative"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-base group-hover:bg-amber-500/10 group-hover:text-amber-600 transition-colors">
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                            {c.default_currency}
                                        </span>

                                        {/* Dropdown More Menu */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setActiveMenuId(activeMenuId === c.id ? null : c.id)}
                                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                            {activeMenuId === c.id && (
                                                <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveMenuId(null);
                                                            setClientToDelete(c);
                                                            setDeleteError(null);
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        <span>Delete Client</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <h3 className="font-bold text-base text-slate-900 tracking-tight">{c.name}</h3>
                                {c.company && <p className="text-xs text-slate-500 mt-0.5">{c.company}</p>}
                                {c.email && <p className="text-xs text-slate-500 font-mono mt-1 truncate">{c.email}</p>}

                                {/* High-Value Financial Metrics */}
                                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Outstanding:</span>
                                        {c.outstanding_by_currency && c.outstanding_by_currency.length > 0 ? (
                                            <div className="flex items-center gap-1.5 font-bold">
                                                {c.outstanding_by_currency.map((o) => (
                                                    <Money key={o.currency} amount={o.amount} currency={o.currency} numberClassName="text-slate-900 text-xs" />
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 font-medium">৳0.00</span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500">Total Received:</span>
                                        <Money 
                                            amount={c.total_received_bdt || '0.00'} 
                                            currency="BDT" 
                                            numberClassName="font-extrabold text-emerald-700 text-xs" 
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-100">
                                        <span>Avg. Days to Pay:</span>
                                        <span className="font-semibold text-slate-700">
                                            {c.average_days_to_pay !== undefined && c.average_days_to_pay !== null ? `${c.average_days_to_pay} days` : 'N/A'}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                                        <span>Last Invoiced:</span>
                                        <span className="font-semibold text-slate-700">
                                            {c.last_invoice_date ? formatDate(c.last_invoice_date) : 'Never'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Client Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-base font-bold text-slate-900">Add New Client</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-semibold w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Client Name *</label>
                                <input
                                    required
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Acme Corp or John Doe"
                                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Company</label>
                                <input
                                    type="text"
                                    value={company}
                                    onChange={(e) => setCompany(e.target.value)}
                                    placeholder="Company name (optional)"
                                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="billing@example.com"
                                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Default Currency</label>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value as any)}
                                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                >
                                    <option value="BDT">BDT - Bangladeshi Taka</option>
                                    <option value="USD">USD - US Dollar</option>
                                    <option value="EUR">EUR - Euro</option>
                                    <option value="GBP">GBP - British Pound</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2.5 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all"
                                >
                                    Save Client
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Destructive Delete Confirmation Modal */}
            {clientToDelete && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-bold text-slate-900">Delete Client Confirmation</h2>
                            <button
                                onClick={() => setClientToDelete(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {deleteError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                                {deleteError}
                            </div>
                        )}

                        <p className="text-xs text-slate-600 leading-relaxed">
                            Are you sure you want to delete <strong className="text-slate-900">{clientToDelete.name}</strong>?
                            Clients with existing invoice records cannot be deleted.
                        </p>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setClientToDelete(null)}
                                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
                            >
                                {deleting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
