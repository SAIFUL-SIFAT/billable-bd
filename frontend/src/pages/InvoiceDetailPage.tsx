import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { invoiceApi } from '../api/billing';
import { getClients } from '../api/clients';
import { useAuth } from '../context/AuthContext';
import type { Invoice, Payment, PaymentMethod, CreatePaymentPayload } from '../types/billing';
import type { Client } from '../types/client';
import { InvoiceStatusBadge } from './InvoicesPage';
import { formatDate, calculateEffectiveRate } from '../utils/formatters';
import { Money } from '../components/Money';
import { 
    Send, 
    ExternalLink, 
    Edit, 
    MoreVertical, 
    Trash2, 
    Ban, 
    Plus, 
    Building, 
    X,
    Lock,
    Mail,
    Download
} from 'lucide-react';
import { generateInvoicePdf } from '../utils/pdfGenerator';

export const InvoiceDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Modals and menus
    const [showSendModal, setShowSendModal] = useState<boolean>(false);
    const [showRecordPaymentModal, setShowRecordPaymentModal] = useState<boolean>(false);
    const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
    const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
    const invoiceDocRef = React.useRef<HTMLDivElement>(null);

    const handleDownloadPdf = async (): Promise<void> => {
        if (!invoiceDocRef.current || !invoice) return;
        try {
            setActionLoading(true);
            setDownloadingPdf(true);
            await generateInvoicePdf({
                element: invoiceDocRef.current,
                filename: invoice.number || `invoice-${invoice.id}`,
            });
            setToastMessage('Invoice PDF exported successfully!');
        } catch (err: any) {
            setErrorMessage('Failed to generate PDF. Please try again.');
        } finally {
            setActionLoading(false);
            setDownloadingPdf(false);
        }
    };

    // Payment Form State
    const [amountApplied, setAmountApplied] = useState<string>('');
    const [feeAmount, setFeeAmount] = useState<string>('0.00');
    const [receivedBdt, setReceivedBdt] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
    const [paidOn, setPaidOn] = useState<string>(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState<string>('');
    const [paymentFormError, setPaymentFormError] = useState<string | null>(null);
    const [recordingPayment, setRecordingPayment] = useState<boolean>(false);

    const loadInvoiceData = async (): Promise<void> => {
        if (!id) return;
        try {
            const [invData, paymentsData] = await Promise.all([
                invoiceApi.getInvoice(Number(id)),
                invoiceApi.getPayments(Number(id)),
            ]);
            setInvoice(invData);
            setPayments(paymentsData);

            // Fetch full client details for Bill To address
            try {
                const clientsRes = await getClients();
                const found = clientsRes.results.find((c) => c.id === invData.client);
                if (found) setClient(found);
            } catch {
                // Client lookup non-blocking
            }

            // Set default amount applied to remaining balance due
            const balance = Math.max(
                0,
                parseFloat(invData.total_amount) - parseFloat(invData.paid_amount || '0')
            );
            setAmountApplied(balance > 0 ? balance.toFixed(2) : '0.00');
        } catch (err) {
            console.error('Failed to load invoice details', err);
            setErrorMessage('Could not load invoice data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInvoiceData();
    }, [id]);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    if (loading) {
        return (
            <div className="p-12 text-center text-sm text-slate-600 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                <span>Loading invoice...</span>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="p-12 text-center space-y-3">
                <p className="text-slate-600 font-medium">Invoice not found.</p>
                <Link to="/invoices" className="text-amber-600 hover:underline text-xs font-semibold">
                    &larr; Back to Invoices
                </Link>
            </div>
        );
    }

    const invoiceCurrency = invoice.currency || client?.default_currency || 'USD';
    const isBdtInvoice = invoiceCurrency.toUpperCase() === 'BDT';

    const balanceDue = Math.max(
        0,
        parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount || '0')
    );

    // --- Action Handlers ---

    const handleSendConfirm = async (): Promise<void> => {
        setActionLoading(true);
        setShowSendModal(false);
        try {
            await invoiceApi.sendInvoice(invoice.id);
            setToastMessage('Invoice locked and assigned next fiscal year sequence number!');
            await loadInvoiceData();
        } catch (err: any) {
            setErrorMessage(err.response?.data?.detail || 'Failed to send invoice.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleVoid = async (): Promise<void> => {
        if (!confirm('Are you sure you want to void this invoice? This action cannot be reversed.'))
            return;
        setActionLoading(true);
        try {
            await invoiceApi.voidInvoice(invoice.id);
            setToastMessage('Invoice successfully voided.');
            await loadInvoiceData();
        } catch (err: any) {
            setErrorMessage(err.response?.data?.detail || 'Failed to void invoice.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async (): Promise<void> => {
        if (!confirm('Permanently delete this draft invoice? Any attached time entries will become unbilled.'))
            return;
        setActionLoading(true);
        try {
            await invoiceApi.deleteInvoice(invoice.id);
            navigate('/invoices');
        } catch (err: any) {
            setErrorMessage(err.response?.data?.detail || 'Failed to delete draft invoice.');
            setActionLoading(false);
        }
    };

    const handleOpenRecordPayment = () => {
        const bal = balanceDue.toFixed(2);
        setAmountApplied(bal);
        setFeeAmount('0.00');
        if (isBdtInvoice) {
            setReceivedBdt(bal);
        } else {
            setReceivedBdt('');
        }
        setPaymentFormError(null);
        setShowRecordPaymentModal(true);
    };

    const handleRecordPayment = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setPaymentFormError(null);

        const applied = parseFloat(amountApplied);
        const fee = parseFloat(feeAmount || '0');
        const received = parseFloat(receivedBdt);

        if (isNaN(applied) || applied <= 0) {
            setPaymentFormError('Applied amount must be greater than 0.');
            return;
        }
        if (applied > balanceDue + 0.0001) {
            setPaymentFormError(`Applied amount cannot exceed remaining balance (${balanceDue.toFixed(2)}).`);
            return;
        }
        if (isNaN(fee) || fee < 0) {
            setPaymentFormError('Fee amount cannot be negative.');
            return;
        }
        if (fee >= applied) {
            setPaymentFormError('Fee must be less than the applied amount.');
            return;
        }
        if (isNaN(received) || received <= 0) {
            setPaymentFormError('Received BDT must be greater than 0.');
            return;
        }
        if (isBdtInvoice) {
            const expected = applied - fee;
            if (Math.abs(received - expected) > 0.01) {
                setPaymentFormError(`For BDT invoices, received BDT must equal applied minus fee (${expected.toFixed(2)}).`);
                return;
            }
        }

        setRecordingPayment(true);
        try {
            const payload: CreatePaymentPayload = {
                amount_applied: applied.toFixed(2),
                fee_amount: fee.toFixed(2),
                received_bdt: received.toFixed(2),
                method: paymentMethod,
                paid_on: paidOn,
                reference: reference.trim() || undefined,
            };
            await invoiceApi.createPayment(invoice.id, payload);
            setToastMessage('Payment successfully recorded!');
            setShowRecordPaymentModal(false);
            await loadInvoiceData();
        } catch (err: any) {
            const msg =
                err.response?.data?.detail ||
                err.response?.data?.message ||
                'Validation error while recording payment.';
            setPaymentFormError(msg);
        } finally {
            setRecordingPayment(false);
        }
    };

    const handleDeletePayment = async (paymentId: number): Promise<void> => {
        if (!confirm('Delete this payment record? The invoice balance and status will be recalculated.'))
            return;
        try {
            await invoiceApi.deletePayment(paymentId);
            setToastMessage('Payment deleted.');
            await loadInvoiceData();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to delete payment.');
        }
    };

    const liveEffectiveRate = calculateEffectiveRate(amountApplied, feeAmount, receivedBdt);

    // Status Timeline
    const steps = [
        { key: 'DRAFT', label: 'Draft' },
        { key: 'SENT', label: 'Sent' },
        { key: 'PARTIALLY_PAID', label: 'Partially Paid' },
        { key: 'PAID', label: 'Paid' },
    ];
    const currentStepIndex = (() => {
        if (invoice.status === 'DRAFT') return 0;
        if (invoice.status === 'SENT') return 1;
        if (invoice.status === 'PARTIALLY_PAID') return 2;
        if (invoice.status === 'PAID') return 3;
        return 1;
    })();

    return (
        <div className="space-y-6">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl text-xs flex items-center space-x-2 transition border border-slate-700">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Breadcrumbs */}
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Link to="/invoices" className="hover:text-slate-700 transition-colors">
                    Invoices
                </Link>
                <span>/</span>
                <span className="text-slate-900 font-mono">
                    {invoice.number || `Draft #${invoice.id}`}
                </span>
            </div>

            {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200/80 text-rose-700 rounded-2xl text-xs font-medium">
                    {errorMessage}
                </div>
            )}

            {/* Status Timeline */}
            {invoice.status !== 'VOID' && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between max-w-2xl mx-auto">
                        {steps.map((st, idx) => {
                            const isCompleted = idx <= currentStepIndex;
                            const isCurrent = idx === currentStepIndex;
                            return (
                                <React.Fragment key={st.key}>
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                                isCurrent
                                                    ? 'bg-amber-500 text-white ring-4 ring-amber-100'
                                                    : isCompleted
                                                    ? 'bg-slate-900 text-white'
                                                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                                            }`}
                                        >
                                            {isCompleted && !isCurrent ? '✓' : idx + 1}
                                        </div>
                                        <span
                                            className={`text-[11px] mt-1 font-semibold uppercase tracking-wider ${
                                                isCurrent
                                                    ? 'text-amber-600'
                                                    : isCompleted
                                                    ? 'text-slate-900'
                                                    : 'text-slate-400'
                                            }`}
                                        >
                                            {st.label}
                                        </span>
                                    </div>
                                    {idx < steps.length - 1 && (
                                        <div
                                            className={`flex-1 h-0.5 mx-2 ${
                                                idx < currentStepIndex ? 'bg-slate-900' : 'bg-slate-200'
                                            }`}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Header Card: Invoice Number, Status Badge, and Action Buttons */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center space-x-3">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                            {invoice.number ? invoice.number : `Draft #${invoice.id}`}
                        </h1>
                        <InvoiceStatusBadge status={invoice.status} dueDate={invoice.due_date} />
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                        Client: <strong className="text-slate-800">{invoice.client_name}</strong> | Issued:{' '}
                        {formatDate(invoice.issue_date)} | Due: {formatDate(invoice.due_date)}
                    </p>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Share / Preview Link */}
                    <button
                        type="button"
                        onClick={async () => {
                            if (invoice.status === 'DRAFT') {
                                navigator.clipboard.writeText(window.location.href);
                                setToastMessage('Draft preview link copied!');
                                return;
                            }
                            try {
                                const { token } = await invoiceApi.shareInvoice(invoice.id);
                                const publicUrl = `${window.location.origin}/public/invoices/${token}`;
                                await navigator.clipboard.writeText(publicUrl);
                                setToastMessage('Signed public invoice link copied to clipboard!');
                            } catch (err: any) {
                                setErrorMessage(err.response?.data?.detail || 'Failed to generate public share link.');
                            }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all"
                    >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                        <span>{invoice.status === 'DRAFT' ? 'Preview as client' : 'Share Public Link'}</span>
                    </button>

                    {/* PDF Download / Print Button (US-22) */}
                    <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf || actionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all print:hidden disabled:opacity-50"
                    >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                    </button>

                    {/* Email Reminder Button (US-25) */}
                    {invoice.status !== 'DRAFT' && invoice.status !== 'VOID' && balanceDue > 0 && (
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    setActionLoading(true);
                                    const res = await invoiceApi.sendReminder(invoice.id);
                                    setToastMessage(res.detail || 'Reminder email sent successfully!');
                                } catch (err: any) {
                                    setErrorMessage(err.response?.data?.detail || 'Failed to send reminder email.');
                                } finally {
                                    setActionLoading(false);
                                }
                            }}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-amber-200 hover:bg-amber-50 text-amber-800 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                        >
                            <Mail className="w-3.5 h-3.5 text-amber-600" />
                            <span>Send Reminder</span>
                        </button>
                    )}

                    {/* DRAFT Actions */}
                    {invoice.status === 'DRAFT' && (
                        <>
                            <Link
                                to={`/invoices/${invoice.id}/edit`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all"
                            >
                                <Edit className="w-3.5 h-3.5 text-slate-500" />
                                <span>Edit</span>
                            </Link>

                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => setShowSendModal(true)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 active:scale-[0.99]"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>Send Invoice</span>
                            </button>

                            {/* More menu for draft deletion */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                                    className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                                {showMoreMenu && (
                                    <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowMoreMenu(false);
                                                handleDelete();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Delete Draft</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* SENT or PARTIALLY_PAID Actions */}
                    {(invoice.status === 'SENT' || invoice.status === 'PARTIALLY_PAID') && (
                        <>
                            {balanceDue > 0 && (
                                <button
                                    type="button"
                                    onClick={handleOpenRecordPayment}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Record Payment</span>
                                </button>
                            )}

                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                                    className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                                {showMoreMenu && (
                                    <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowMoreMenu(false);
                                                handleVoid();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                                        >
                                            <Ban className="w-3.5 h-3.5" />
                                            <span>Void Invoice</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Printable Invoice Document Sheet (Captured for PDF export) */}
            <div ref={invoiceDocRef} className="space-y-6 bg-slate-50/30 p-2 sm:p-4 rounded-3xl">
                {/* Bill To / From Block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bill From */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>Billed From (You)</span>
                        </div>
                        <div className="text-sm font-bold text-slate-900">{user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'Freelance Business'}</div>
                        <div className="text-xs text-slate-600 mt-1 font-mono">{user?.email}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Dhaka, Bangladesh</div>
                    </div>

                    {/* Bill To */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <span>Billed To (Client)</span>
                        </div>
                        <div className="text-sm font-bold text-slate-900">{invoice.client_name || client?.name}</div>
                        {client?.company && <div className="text-xs text-slate-600">{client.company}</div>}
                        {client?.address ? (
                            <div className="text-xs text-slate-500 whitespace-pre-line mt-1">{client.address}</div>
                        ) : (
                            <div className="text-xs text-slate-500 mt-1">Country: {client?.country || 'International'}</div>
                        )}
                        <div className="text-xs text-slate-500 mt-1">Billing Currency: <span className="font-bold text-slate-800">{invoiceCurrency}</span></div>
                    </div>
                </div>

                {/* Line Items Table Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Billed Line Items
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                            <thead className="bg-white">
                                <tr>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Description
                                    </th>
                                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Quantity / Hrs
                                    </th>
                                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Unit Price
                                    </th>
                                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Subtotal
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {invoice.items && invoice.items.length > 0 ? (
                                    invoice.items.map((item, idx) => (
                                        <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 text-slate-900 font-semibold text-xs">{item.description}</td>
                                            <td className="px-6 py-4 text-right text-slate-600 font-mono text-xs">
                                                {parseFloat(String(item.quantity)).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Money amount={item.unit_price} currency={invoiceCurrency} numberClassName="text-xs text-slate-700" />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Money amount={item.subtotal} currency={invoiceCurrency} numberClassName="text-xs font-bold text-slate-900" />
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-4 text-center text-xs text-slate-500">
                                            No line items attached.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Financial Totals Breakdown Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Financial Summary</h3>
                        <p className="text-xs text-slate-600 max-w-sm">
                            Amounts are maintained in the invoice currency (<span className="font-semibold text-slate-800">{invoiceCurrency}</span>). Converted BDT is recorded upon remittance.
                        </p>
                    </div>

                    <div className="w-full md:w-80 space-y-2.5 text-xs bg-slate-50/80 p-5 rounded-2xl border border-slate-200">
                        <div className="flex justify-between text-slate-600">
                            <span>Subtotal:</span>
                            <Money amount={invoice.subtotal} currency={invoiceCurrency} numberClassName="font-semibold text-slate-900" />
                        </div>
                        {parseFloat(invoice.tax_rate) > 0 && (
                            <div className="flex justify-between text-slate-600">
                                <span>Tax ({parseFloat(invoice.tax_rate)}%):</span>
                                <Money amount={invoice.tax_amount} currency={invoiceCurrency} numberClassName="font-semibold text-slate-900" />
                            </div>
                        )}
                        <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900 text-sm">
                            <span>Total Due:</span>
                            <Money amount={invoice.total_amount} currency={invoiceCurrency} numberClassName="text-sm font-bold text-slate-900" />
                        </div>
                        <div className="flex justify-between text-emerald-700 font-semibold">
                            <span>Paid to Date:</span>
                            <Money amount={invoice.paid_amount || '0.00'} currency={invoiceCurrency} numberClassName="text-emerald-700 font-bold" />
                        </div>
                        <div className="border-t border-slate-200/80 pt-2 flex justify-between font-extrabold text-sm">
                            <span className="text-slate-900">Remaining Balance:</span>
                            {balanceDue > 0 ? (
                                <Money amount={balanceDue.toFixed(2)} currency={invoiceCurrency} numberClassName="font-bold text-slate-900" />
                            ) : (
                                <span className="text-emerald-700 font-bold">Settled</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Ledger Panel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-5">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Payment Ledger & Foreign Exchange Remittances
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                            Track client payments, deductions/fees, and converted Bangladeshi Taka (BDT) with effective conversion rates.
                        </p>
                    </div>

                    {(invoice.status === 'SENT' || invoice.status === 'PARTIALLY_PAID') && balanceDue > 0 && (
                        <button
                            type="button"
                            onClick={handleOpenRecordPayment}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Record Payment</span>
                        </button>
                    )}
                </div>

                {/* Existing Payments List */}
                {invoice.status === 'DRAFT' ? (
                    <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                        <Lock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs text-slate-600 font-medium">You can record payments after sending</p>
                    </div>
                ) : payments.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-600">No payments recorded yet for this invoice.</p>
                    </div>
                ) : (
                    <div className="border border-slate-200/80 rounded-xl overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Date & Method
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Amount Applied
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Fee Deducted
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Received (BDT)
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Effective Rate
                                    </th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {payments.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-4 py-3 text-slate-900">
                                            <div className="font-semibold text-slate-900 text-xs">{formatDate(p.paid_on)}</div>
                                            <div className="text-[11px] text-slate-500 capitalize">
                                                {p.method.replace('_', ' ')} {p.reference ? `• ${p.reference}` : ''}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Money amount={p.amount_applied} currency={invoiceCurrency} numberClassName="text-xs font-semibold text-slate-900" />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Money amount={p.fee_amount} currency={invoiceCurrency} numberClassName="text-xs text-slate-600" />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Money amount={p.received_bdt} currency="BDT" numberClassName="text-xs font-bold text-emerald-700" />
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs font-bold text-slate-800 font-mono">
                                            ৳{parseFloat(p.effective_rate).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleDeletePayment(p.id)}
                                                className="text-xs text-rose-600 hover:text-rose-800 font-semibold hover:bg-rose-50 px-2 py-1 rounded transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* SEND CONFIRMATION MODAL */}
            {showSendModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="flex justify-between items-start">
                            <h3 className="text-base font-bold text-slate-900">Send Invoice Confirmation</h3>
                            <button
                                onClick={() => setShowSendModal(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            This locks the invoice and assigns the next number in FY2026-27.
                            Once sent, line items and client terms cannot be edited.
                        </p>
                        <div className="flex justify-end space-x-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowSendModal(false)}
                                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={handleSendConfirm}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                            >
                                {actionLoading ? 'Assigning...' : 'Confirm & Send'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RECORD PAYMENT MODAL */}
            {showRecordPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Record Payment Remittance</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Remaining Balance: <strong className="text-slate-800">{invoiceCurrency} {balanceDue.toFixed(2)}</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setShowRecordPaymentModal(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {paymentFormError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                                {paymentFormError}
                            </div>
                        )}

                        <form onSubmit={handleRecordPayment} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {/* Amount Applied */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                                        Amount Applied ({invoiceCurrency}) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={balanceDue}
                                        required
                                        value={amountApplied}
                                        onChange={(e) => setAmountApplied(e.target.value)}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                                    />
                                </div>

                                {/* Fee Amount */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                                        Processor Fee ({invoiceCurrency})
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.00"
                                        value={feeAmount}
                                        onChange={(e) => setFeeAmount(e.target.value)}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {/* Received BDT */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                                        Received BDT in Bank / MFS *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        required
                                        value={receivedBdt}
                                        onChange={(e) => setReceivedBdt(e.target.value)}
                                        placeholder="e.g. 118000.00"
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                                    />
                                </div>

                                {/* Payment Method */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                                        Remittance Gateway *
                                    </label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    >
                                        <option value="bank_transfer">Direct Bank Wire</option>
                                        <option value="wise">Wise</option>
                                        <option value="payoneer">Payoneer</option>
                                        <option value="paypal">PayPal</option>
                                        <option value="bkash">bKash</option>
                                        <option value="nagad">Nagad</option>
                                        <option value="other">Other Channel</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {/* Date */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                                        Remittance Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={paidOn}
                                        onChange={(e) => setPaidOn(e.target.value)}
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                                    />
                                </div>

                                {/* Reference */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                                        Transaction / Ref (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={reference}
                                        onChange={(e) => setReference(e.target.value)}
                                        placeholder="e.g. WISE-98765"
                                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Live Effective Rate Indicator */}
                            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                                    Derived Effective Rate:
                                </span>
                                <span className="text-xs font-bold text-slate-900 font-mono">
                                    {liveEffectiveRate ? `৳${liveEffectiveRate} / ${invoiceCurrency}` : '—'}
                                </span>
                            </div>

                            <div className="flex justify-end space-x-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRecordPaymentModal(false)}
                                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={recordingPayment}
                                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                                >
                                    {recordingPayment ? 'Recording...' : 'Submit Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};