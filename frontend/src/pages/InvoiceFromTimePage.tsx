import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Clock, 
    ArrowLeft, 
    ArrowRight, 
    Calendar, 
    Percent, 
    User, 
    CheckCircle2, 
    AlertCircle, 
    Layers, 
    FileText,
    ChevronRight,
    Sparkles
} from 'lucide-react';
import { invoiceApi, billingApi } from '../api/billing';
import { getClients, getProjects } from '../api/clients';
import type { Client, Project } from '../types/client';
import type { TimeEntry } from '../types/billing';
import { formatCurrency, formatDate } from '../utils/formatters';

export const InvoiceFromTimePage: React.FC = () => {
    const navigate = useNavigate();

    // Wizard step tracking: 1 = Client, 2 = Date Range, 3 = Review Lines
    const [step, setStep] = useState<number>(1);

    // Form inputs
    const [clients, setClients] = useState<Client[]>([]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [selectedClient, setSelectedClient] = useState<number | ''>('');
    const [dateFrom, setDateFrom] = useState<string>(() => {
        const d = new Date();
        d.setDate(1); // 1st of current month
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState<string>(() => {
        return new Date().toISOString().split('T')[0]; // today
    });
    const [taxRate, setTaxRate] = useState<number>(0);

    // Review state
    const [unbilledEntries, setUnbilledEntries] = useState<TimeEntry[]>([]);
    const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Load clients and projects on mount
    useEffect(() => {
        const init = async (): Promise<void> => {
            try {
                const [clientRes, projectRes] = await Promise.all([getClients(), getProjects()]);
                setClients(clientRes.results || []);
                setAllProjects(projectRes.results || []);
            } catch (err) {
                console.error('Failed to load clients and projects', err);
            }
        };
        init();
    }, []);

    // Fetch unbilled entries for the selected client and date range
    const fetchUnbilledEntries = async (): Promise<void> => {
        if (!selectedClient) return;
        setLoadingPreview(true);
        setErrorMessage(null);
        try {
            // Get projects belonging to this client
            const clientProjectIds = allProjects
                .filter((p) => p.client === Number(selectedClient))
                .map((p) => p.id);

            // Fetch unbilled time entries
            const res = await billingApi.getTimeEntries({
                is_billed: 'false',
                date_after: dateFrom,
                date_before: dateTo,
            });

            // Filter entries that belong to the selected client's projects
            const filtered = (res.results || []).filter((entry) =>
                clientProjectIds.includes(entry.project)
            );
            setUnbilledEntries(filtered);
        } catch (err) {
            console.error('Failed to load unbilled preview', err);
            setErrorMessage('Could not load time entries preview.');
        } finally {
            setLoadingPreview(false);
        }
    };

    // Group unbilled entries by project for line summary preview
    const projectSummary = React.useMemo(() => {
        const groups: Record<
            number,
            { projectName: string; hours: number; rate: number; subtotal: number }
        > = {};

        unbilledEntries.forEach((entry) => {
            const proj = allProjects.find((p) => p.id === entry.project);
            const rate = proj?.hourly_rate ? parseFloat(String(proj.hourly_rate)) : 0;
            const hrs = parseFloat(entry.hours) || 0;

            if (!groups[entry.project]) {
                groups[entry.project] = {
                    projectName: entry.project_name || proj?.name || `Project #${entry.project}`,
                    hours: 0,
                    rate,
                    subtotal: 0,
                };
            }
            groups[entry.project].hours += hrs;
            groups[entry.project].subtotal += hrs * rate;
        });

        return Object.values(groups);
    }, [unbilledEntries, allProjects]);

    const totalEstimatedHours = projectSummary.reduce((acc, p) => acc + p.hours, 0);
    const totalEstimatedSubtotal = projectSummary.reduce((acc, p) => acc + p.subtotal, 0);
    const totalEstimatedTax = (totalEstimatedSubtotal * (Number(taxRate) || 0)) / 100;
    const totalEstimatedGrandTotal = totalEstimatedSubtotal + totalEstimatedTax;

    // Move to Step 3: validate and fetch entries
    const handleGoToReview = async (): Promise<void> => {
        if (!selectedClient) {
            setErrorMessage('Please select a client.');
            return;
        }
        if (!dateFrom || !dateTo) {
            setErrorMessage('Please specify both start and end dates.');
            return;
        }
        if (dateFrom > dateTo) {
            setErrorMessage('Start date must be before or equal to end date.');
            return;
        }
        setStep(3);
        await fetchUnbilledEntries();
    };

    // Create invoice via the atomic backend endpoint
    const handleCreateInvoice = async (): Promise<void> => {
        setSubmitting(true);
        setErrorMessage(null);
        try {
            const payload = {
                client: Number(selectedClient),
                date_from: dateFrom,
                date_to: dateTo,
                tax_rate: Number(taxRate) || 0,
            };

            const created = await invoiceApi.createInvoiceFromTime(payload);
            navigate(`/invoices/${created.id}`);
        } catch (err: any) {
            console.error('Failed to create invoice from time', err);
            const msg =
                err.response?.data?.detail ||
                err.response?.data?.message ||
                JSON.stringify(err.response?.data) ||
                'Failed to generate invoice from unbilled time.';
            setErrorMessage(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const clientObj = clients.find((c) => c.id === Number(selectedClient));

    return (
        <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Header & Breadcrumb */}
            <div className="space-y-3">
                <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Link to="/invoices" className="hover:text-slate-900 transition flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Invoices
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-900 font-semibold">From Unbilled Time</span>
                </nav>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-semibold mb-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Smart Time Billing
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                            Create Invoice from Time Entries
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Group tracked hourly work for a client and generate a consolidated draft invoice in one click.
                        </p>
                    </div>

                    <Link
                        to="/invoices"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition self-start sm:self-auto"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Invoices
                    </Link>
                </div>
            </div>

            {/* Stepper Progress */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6">
                <div className="grid grid-cols-3 gap-2 sm:gap-4 relative">
                    {/* Step 1 */}
                    <div
                        onClick={() => step > 1 && setStep(1)}
                        className={`flex items-center gap-3 p-2.5 rounded-xl transition cursor-pointer ${
                            step === 1
                                ? 'bg-amber-50 text-amber-900 font-semibold'
                                : step > 1
                                ? 'text-slate-700 hover:bg-slate-50'
                                : 'text-slate-400'
                        }`}
                    >
                        <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition ${
                                step > 1
                                    ? 'bg-emerald-500 text-white'
                                    : step === 1
                                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                                    : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                            {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                        </div>
                        <div className="min-w-0 hidden sm:block">
                            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold leading-none mb-1">
                                Step 1
                            </p>
                            <p className="text-sm truncate">Select Client</p>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div
                        onClick={() => {
                            if (selectedClient && step === 3) setStep(2);
                        }}
                        className={`flex items-center gap-3 p-2.5 rounded-xl transition ${
                            selectedClient && step === 3 ? 'cursor-pointer hover:bg-slate-50' : ''
                        } ${
                            step === 2
                                ? 'bg-amber-50 text-amber-900 font-semibold'
                                : step > 2
                                ? 'text-slate-700'
                                : 'text-slate-400'
                        }`}
                    >
                        <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition ${
                                step > 2
                                    ? 'bg-emerald-500 text-white'
                                    : step === 2
                                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                                    : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                            {step > 2 ? <CheckCircle2 className="w-4 h-4" /> : '2'}
                        </div>
                        <div className="min-w-0 hidden sm:block">
                            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold leading-none mb-1">
                                Step 2
                            </p>
                            <p className="text-sm truncate">Date & Tax</p>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div
                        className={`flex items-center gap-3 p-2.5 rounded-xl transition ${
                            step === 3
                                ? 'bg-amber-50 text-amber-900 font-semibold'
                                : 'text-slate-400'
                        }`}
                    >
                        <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition ${
                                step === 3
                                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                                    : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                            3
                        </div>
                        <div className="min-w-0 hidden sm:block">
                            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold leading-none mb-1">
                                Step 3
                            </p>
                            <p className="text-sm truncate">Review & Generate</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm animate-in fade-in duration-200">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* STEP 1: Select Client */}
            {step === 1 && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Step 1: Choose a Client</h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Select the target client to query unbilled logs and hourly project work.
                            </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
                            <User className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="space-y-2 max-w-lg">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Target Client
                        </label>
                        <div className="relative">
                            <select
                                value={selectedClient}
                                onChange={(e) => setSelectedClient(Number(e.target.value) || '')}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition appearance-none cursor-pointer pr-10"
                            >
                                <option value="">Select a client...</option>
                                {clients.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {c.company ? `(${c.company})` : ''} — Currency: {c.default_currency}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-400">
                                <ChevronRight className="w-4 h-4 rotate-90" />
                            </div>
                        </div>
                    </div>

                    {selectedClient && clientObj && (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm">
                                    {clientObj.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{clientObj.name}</p>
                                    <p className="text-xs text-slate-500">{clientObj.company || 'Direct Client'} • Default {clientObj.default_currency}</p>
                                </div>
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/50">
                                Ready for Billing
                            </span>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            disabled={!selectedClient}
                            onClick={() => setStep(2)}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Next: Date Range & Tax
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 2: Date Range & Tax */}
            {step === 2 && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Step 2: Date Range & Billing Terms</h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Filter logged timesheet entries between specific dates for <span className="font-semibold text-slate-800">{clientObj?.name}</span>.
                            </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
                            <Calendar className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                Date From
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                Date To
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Percent className="w-3.5 h-3.5" />
                                Tax Rate (%)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={taxRate}
                                onChange={(e) => setTaxRate(Number(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition font-mono"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                        <button
                            type="button"
                            onClick={handleGoToReview}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-sm transition active:scale-[0.99]"
                        >
                            Review Unbilled Entries
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 3: Review Lines & Create */}
            {step === 3 && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Step 3: Review Generated Invoice Items</h2>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    Client: <span className="font-semibold text-slate-800">{clientObj?.name}</span> • Period: {formatDate(dateFrom)} to {formatDate(dateTo)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline self-start sm:self-auto"
                            >
                                Modify Range / Tax
                            </button>
                        </div>

                        {loadingPreview ? (
                            <div className="p-16 text-center space-y-3">
                                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                <p className="text-sm font-medium text-slate-600">Scanning unbilled timesheet records...</p>
                            </div>
                        ) : unbilledEntries.length === 0 ? (
                            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                                    <Clock className="w-6 h-6" />
                                </div>
                                <h3 className="text-sm font-semibold text-slate-800">No Unbilled Entries Found</h3>
                                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                    There are no pending, unbilled hours logged for <span className="font-medium text-slate-700">{clientObj?.name}</span> within the selected period ({formatDate(dateFrom)} – {formatDate(dateTo)}).
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Grouped Project Summary Lines Table */}
                                <div className="rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
                                    <div className="bg-slate-50/70 px-4 py-3 border-b border-slate-200/80 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-slate-500" />
                                            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                                Consolidated Line Items ({projectSummary.length})
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            {unbilledEntries.length} raw time logs bundled
                                        </span>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-100 bg-white text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                    <th className="py-3 px-4">Project Line</th>
                                                    <th className="py-3 px-4 text-right">Logged Hours</th>
                                                    <th className="py-3 px-4 text-right">Agreed Rate</th>
                                                    <th className="py-3 px-4 text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {projectSummary.map((ps, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                                                        <td className="py-3 px-4">
                                                            <div className="font-semibold text-slate-900">{ps.projectName}</div>
                                                            <div className="text-xs text-slate-400">Bundled timesheet line item</div>
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                                                            {ps.hours.toFixed(2)} hrs
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                                                            {formatCurrency(ps.rate, clientObj?.default_currency)}/hr
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                                            {formatCurrency(ps.subtotal, clientObj?.default_currency)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Estimated Totals Callout */}
                                <div className="flex justify-end pt-2">
                                    <div className="w-full sm:w-80 bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-2.5">
                                        <div className="flex justify-between text-xs text-slate-600">
                                            <span>Total Billable Hours:</span>
                                            <span className="font-mono font-bold text-slate-900">
                                                {totalEstimatedHours.toFixed(2)} hrs
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-600">
                                            <span>Base Subtotal:</span>
                                            <span className="font-mono font-medium text-slate-900">
                                                {formatCurrency(totalEstimatedSubtotal, clientObj?.default_currency)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-600">
                                            <span>Tax ({taxRate}%):</span>
                                            <span className="font-mono font-medium text-slate-900">
                                                {formatCurrency(totalEstimatedTax, clientObj?.default_currency)}
                                            </span>
                                        </div>
                                        <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                                            <span className="text-sm font-bold text-slate-900">Estimated Total:</span>
                                            <span className="text-lg font-bold font-mono text-amber-600">
                                                {formatCurrency(totalEstimatedGrandTotal, clientObj?.default_currency)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Action Buttons */}
                        <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>
                            <button
                                type="button"
                                disabled={submitting || unbilledEntries.length === 0}
                                onClick={handleCreateInvoice}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Generating Draft...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 text-amber-400" />
                                        Confirm & Create Draft Invoice
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


