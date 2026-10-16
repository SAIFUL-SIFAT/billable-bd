import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { invoiceApi } from '../api/billing';
import { getClients } from '../api/clients';
import type { Client } from '../types/client';
import { Money } from '../components/Money';
import { Plus, Trash2, FileText } from 'lucide-react';

interface InvoiceFormItem {
    description: string;
    quantity: number | string;
    unit_price: number | string;
}

interface InvoiceFormData {
    client: number | string;
    issue_date: string;
    due_date: string;
    tax_rate: number | string;
    notes: string;
    items: InvoiceFormItem[];
}

export const InvoiceFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isEditing = Boolean(id);
    const navigate = useNavigate();

    const [clients, setClients] = useState<Client[]>([]);
    const [loadingInvoice, setLoadingInvoice] = useState<boolean>(isEditing);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Default dates: issue today, due in 14 days (Net 14)
    const today = new Date().toISOString().split('T')[0];
    const defaultDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm<InvoiceFormData>({
        defaultValues: {
            client: '',
            issue_date: today,
            due_date: defaultDueDate,
            tax_rate: 0,
            notes: '',
            items: [{ description: '', quantity: 1, unit_price: 0 }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'items',
    });

    const [taxPresets, setTaxPresets] = useState<number[]>([0, 5, 10, 15]);

    // Load clients and profile presets
    useEffect(() => {
        const loadInitialData = async (): Promise<void> => {
            try {
                const [clientsRes, profileRes] = await Promise.all([
                    getClients(),
                    import('../api/profile').then(m => m.profileApi.getProfile()).catch(() => null),
                ]);
                setClients(clientsRes.results || []);
                if (profileRes?.tax_rate_presets && profileRes.tax_rate_presets.length > 0) {
                    setTaxPresets(profileRes.tax_rate_presets);
                }
            } catch (err) {
                console.error('Failed to load initial data', err);
            }
        };
        loadInitialData();
    }, []);

    // If editing existing draft invoice, load its data
    useEffect(() => {
        if (!id) return;
        const loadDraft = async () => {
            try {
                setLoadingInvoice(true);
                const inv = await invoiceApi.getInvoice(Number(id));
                if (inv.status !== 'DRAFT') {
                    setErrorMessage('Only DRAFT invoices can be edited.');
                    return;
                }
                reset({
                    client: inv.client,
                    issue_date: inv.issue_date,
                    due_date: inv.due_date,
                    tax_rate: parseFloat(inv.tax_rate) || 0,
                    notes: inv.notes || '',
                    items: inv.items.map((it) => ({
                        description: it.description,
                        quantity: parseFloat(String(it.quantity)),
                        unit_price: parseFloat(String(it.unit_price)),
                    })),
                });
            } catch (err) {
                console.error('Failed to load invoice for editing', err);
                setErrorMessage('Failed to load invoice.');
            } finally {
                setLoadingInvoice(false);
            }
        };
        loadDraft();
    }, [id, reset]);

    const watchedItems = watch('items') || [];
    const watchedTaxRate = Number(watch('tax_rate')) || 0;
    const watchedClientId = watch('client');
    const watchedIssueDate = watch('issue_date') || today;

    const selectedClient = clients.find((c) => String(c.id) === String(watchedClientId));
    const activeCurrency = selectedClient?.default_currency || 'BDT';

    // Due date net term chip helpers
    const setNetDays = (days: number) => {
        const base = new Date(watchedIssueDate);
        if (isNaN(base.getTime())) return;
        const target = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
        setValue('due_date', target.toISOString().split('T')[0]);
    };

    // Client-side totals preview (authoritative calculations happen on server)
    const previewSubtotal = watchedItems.reduce((acc, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        return acc + qty * price;
    }, 0);

    const previewTaxAmount = (previewSubtotal * watchedTaxRate) / 100;
    const previewTotal = previewSubtotal + previewTaxAmount;

    const onSubmit = async (data: InvoiceFormData): Promise<void> => {
        setSubmitting(true);
        setErrorMessage(null);
        try {
            const payload = {
                client: Number(data.client),
                issue_date: data.issue_date,
                due_date: data.due_date,
                tax_rate: Number(data.tax_rate),
                notes: data.notes,
                items: data.items.map((item) => ({
                    description: item.description,
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                })),
            };

            if (isEditing && id) {
                const updated = await invoiceApi.updateInvoice(Number(id), payload);
                navigate(`/invoices/${updated.id}`);
            } else {
                const created = await invoiceApi.createInvoice(payload);
                navigate(`/invoices/${created.id}`);
            }
        } catch (err: any) {
            console.error('Failed to save invoice', err);
            const msg =
                err.response?.data?.detail ||
                err.response?.data?.message ||
                JSON.stringify(err.response?.data) ||
                'Failed to save invoice. Please check your inputs.';
            setErrorMessage(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingInvoice) {
        return (
            <div className="p-12 text-center text-slate-600 text-sm flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                <span>Loading invoice details...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Link to="/invoices" className="hover:text-slate-700 transition-colors">
                    Invoices
                </Link>
                <span>/</span>
                <span className="text-slate-900 font-sans">{isEditing ? 'Edit Draft' : 'New Invoice'}</span>
            </div>

            {/* Page Header with Currency Badge */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        {isEditing ? 'Edit Draft Invoice' : 'Create New Invoice'}
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                        Configure billable items, client terms, and real-time taxes.
                    </p>
                </div>
                {selectedClient && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200/80 rounded-xl">
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">Billing Currency:</span>
                        <span className="text-xs font-bold text-slate-900 font-mono bg-white px-2 py-0.5 rounded-lg border border-amber-200 shadow-xs">
                            {activeCurrency}
                        </span>
                    </div>
                )}
            </div>

            {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200/80 text-rose-700 rounded-2xl text-sm font-medium">
                    {errorMessage}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* General Invoice Details Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-5">
                    <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Invoice Information</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Client Selection */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                                Client *
                            </label>
                            <select
                                {...register('client', { required: 'Client is required' })}
                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            >
                                <option value="">Select a client...</option>
                                {clients.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {c.company ? `(${c.company})` : ''} - Currency: {c.default_currency}
                                    </option>
                                ))}
                            </select>
                            {errors.client && (
                                <span className="text-xs text-rose-600 mt-1 block font-medium">{errors.client.message}</span>
                            )}
                        </div>

                        {/* Tax Rate with Presets */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                                    Tax Rate (%)
                                </label>
                                {taxPresets.length > 0 && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-slate-400 font-medium mr-1">Presets:</span>
                                        {taxPresets.map((rate) => (
                                            <button
                                                key={rate}
                                                type="button"
                                                onClick={() => setValue('tax_rate', rate)}
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition ${
                                                    Number(watchedTaxRate) === rate
                                                        ? 'bg-amber-500 text-white border-amber-600'
                                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                                }`}
                                            >
                                                {rate}%
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                {...register('tax_rate', { min: 0 })}
                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
                                placeholder="0.00"
                            />
                        </div>

                        {/* Issue Date */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                                Issue Date *
                            </label>
                            <input
                                type="date"
                                {...register('issue_date', { required: 'Issue date is required' })}
                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
                            />
                        </div>

                        {/* Due Date with Net Terms Shortcuts */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                                    Due Date *
                                </label>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setNetDays(7)}
                                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                    >
                                        Net 7
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNetDays(14)}
                                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                    >
                                        Net 14
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNetDays(30)}
                                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                    >
                                        Net 30
                                    </button>
                                </div>
                            </div>
                            <input
                                type="date"
                                {...register('due_date', { required: 'Due date is required' })}
                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
                            />
                        </div>
                    </div>

                    {/* Notes & Terms */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                            Notes / Payment Terms (Optional)
                        </label>
                        <textarea
                            rows={2}
                            {...register('notes')}
                            placeholder="e.g., Payment due within 14 days of receipt. Remittance via bank transfer or Wise."
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                    </div>
                </div>

                {/* Line Items Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Line Items</h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Add billable deliverables or tasks, hours/quantities, and unit prices.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}
                            className="inline-flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-3 py-1.5 rounded-xl transition"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Item</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {fields.map((field, index) => {
                            const currentQty = Number(watchedItems[index]?.quantity) || 0;
                            const currentPrice = Number(watchedItems[index]?.unit_price) || 0;
                            const itemSubtotal = currentQty * currentPrice;

                            return (
                                <div
                                    key={field.id}
                                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/70 hover:border-slate-300 transition-all"
                                >
                                    {/* Description */}
                                    <div className="flex-1 w-full">
                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                            Description *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Item description or deliverables"
                                            {...register(`items.${index}.description` as const, {
                                                required: true,
                                            })}
                                            className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                        />
                                    </div>

                                    {/* Quantity */}
                                    <div className="w-full sm:w-24">
                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                            Qty / Hrs
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            placeholder="Qty"
                                            {...register(`items.${index}.quantity` as const, {
                                                required: true,
                                                min: 0.01,
                                            })}
                                            className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
                                        />
                                    </div>

                                    {/* Unit Price */}
                                    <div className="w-full sm:w-32">
                                        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                            Unit Rate ({activeCurrency})
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00"
                                            {...register(`items.${index}.unit_price` as const, {
                                                required: true,
                                                min: 0,
                                            })}
                                            className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
                                        />
                                    </div>

                                    {/* Line Subtotal Preview */}
                                    <div className="w-full sm:w-28 text-right font-bold text-xs text-slate-900 font-mono py-1 sm:py-0">
                                        <Money amount={itemSubtotal.toFixed(2)} currency={activeCurrency} />
                                    </div>

                                    {/* Remove Item Button with visible tap area and hover */}
                                    <div className="w-8 flex justify-center">
                                        <button
                                            type="button"
                                            disabled={fields.length === 1}
                                            onClick={() => remove(index)}
                                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 p-2 rounded-xl transition-all"
                                            title="Remove item"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Sticky Bottom Bar for Real-time Totals and Actions */}
                <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-6 text-xs text-slate-600 w-full sm:w-auto justify-between sm:justify-start">
                        <div>
                            <span className="text-slate-500 block">Subtotal</span>
                            <Money amount={previewSubtotal.toFixed(2)} currency={activeCurrency} numberClassName="font-semibold text-slate-800" />
                        </div>
                        {watchedTaxRate > 0 && (
                            <div>
                                <span className="text-slate-500 block">Tax ({watchedTaxRate}%)</span>
                                <Money amount={previewTaxAmount.toFixed(2)} currency={activeCurrency} numberClassName="font-semibold text-slate-800" />
                            </div>
                        )}
                        <div className="border-l border-slate-200 pl-4">
                            <span className="text-slate-500 uppercase tracking-wider font-semibold block text-[11px]">Total Due</span>
                            <Money amount={previewTotal.toFixed(2)} currency={activeCurrency} numberClassName="text-base font-extrabold text-slate-900" />
                        </div>
                    </div>

                    <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                        <Link
                            to="/invoices"
                            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow transition-all disabled:opacity-50 active:scale-[0.99]"
                        >
                            {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Draft Invoice'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};
