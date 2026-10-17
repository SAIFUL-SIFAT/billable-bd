import React, { useState, useEffect } from 'react';
import { expensesApi, type ExpenseData } from '../api/expenses';
import { formatDate } from '../utils/formatters';
import { 
    Plus, 
    Trash2, 
    Download, 
    CreditCard, 
    TrendingDown, 
    X,
    Loader2
} from 'lucide-react';

export const ExpensesPage: React.FC = () => {
    const [expenses, setExpenses] = useState<ExpenseData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form inputs
    const [category, setCategory] = useState('software');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('BDT');
    const [amountBdt, setAmountBdt] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const data = await expensesApi.getExpenses();
            setExpenses(data);
        } catch (err) {
            console.error('Failed to load expenses', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, []);

    // Auto-fill BDT equivalent if currency is BDT
    const handleAmountChange = (val: string) => {
        setAmount(val);
        if (currency === 'BDT') {
            setAmountBdt(val);
        }
    };

    const handleCurrencyChange = (curr: string) => {
        setCurrency(curr);
        if (curr === 'BDT') {
            setAmountBdt(amount);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await expensesApi.createExpense({
                category,
                description,
                amount,
                currency,
                amount_bdt: amountBdt,
                date,
            });
            setShowModal(false);
            setDescription('');
            setAmount('');
            setAmountBdt('');
            fetchExpenses();
        } catch (err) {
            alert('Failed to log expense.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this expense entry?')) return;
        try {
            await expensesApi.deleteExpense(id);
            fetchExpenses();
        } catch (err) {
            alert('Failed to delete expense.');
        }
    };

    const handleExportCsv = async () => {
        try {
            const blob = await expensesApi.exportCsv();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'expenses.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            console.error('Failed to export expenses CSV', err);
        }
    };

    const totalExpenseBdt = expenses.reduce((acc, exp) => acc + (parseFloat(exp.amount_bdt) || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Business Expenses</h1>
                    <p className="text-sm text-slate-600 mt-1">
                        Track tools, software, internet, and hosting costs to monitor true net freelance profit.
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition"
                    >
                        <Download className="w-4 h-4 text-slate-500" />
                        <span>Export CSV</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition active:scale-[0.99]"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Log Expense</span>
                    </button>
                </div>
            </div>

            {/* Total Expense Summary Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                        <TrendingDown className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Logged Expenses</div>
                        <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                            ৳{totalExpenseBdt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
                <div className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{expenses.length}</span> recorded expenses
                </div>
            </div>

            {/* Expenses Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center h-48 text-slate-500 text-xs gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading expenses...</span>
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <h3 className="text-sm font-bold text-slate-800">No expenses logged yet</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            Log software subscriptions (GitHub, JetBrains), coworking space, and equipment fees.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-right">BDT Equivalent</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {expenses.map((exp) => (
                                    <tr key={exp.id} className="hover:bg-slate-50/60 transition">
                                        <td className="px-4 py-3 font-mono text-slate-600">{formatDate(exp.date)}</td>
                                        <td className="px-4 py-3 capitalize font-medium text-slate-700">{exp.category}</td>
                                        <td className="px-4 py-3 font-bold text-slate-900">{exp.description}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                                            {exp.currency} {parseFloat(exp.amount).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                                            ৳{parseFloat(exp.amount_bdt).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(exp.id)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                                title="Delete Expense"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Log Expense Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-slate-900">Log Business Expense</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600 w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Description *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g. GitHub Copilot Subscription"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10"
                                    >
                                        <option value="software">Software & SaaS</option>
                                        <option value="hardware">Hardware & Tools</option>
                                        <option value="office">Office & Desk</option>
                                        <option value="utilities">Internet & Power</option>
                                        <option value="tax">Tax & Legal</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Amount *
                                    </label>
                                    <div className="flex gap-1.5">
                                        <select
                                            value={currency}
                                            onChange={(e) => handleCurrencyChange(e.target.value)}
                                            className="px-2 py-2 rounded-xl border border-slate-200 text-slate-900 font-mono"
                                        >
                                            <option value="BDT">BDT</option>
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="GBP">GBP</option>
                                        </select>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            required
                                            value={amount}
                                            onChange={(e) => handleAmountChange(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 font-mono"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        BDT Equivalent *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        required
                                        value={amountBdt}
                                        onChange={(e) => setAmountBdt(e.target.value)}
                                        placeholder="৳0.00"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : 'Save Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
