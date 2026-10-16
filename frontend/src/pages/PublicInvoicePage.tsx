import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { invoiceApi } from '../api/billing';
import { formatCurrency, formatDate } from '../utils/formatters';
import { CheckCircle2, Clock, AlertCircle, ShieldCheck, Download } from 'lucide-react';
import { generateInvoicePdf } from '../utils/pdfGenerator';

interface PublicInvoiceItem {
    id: number;
    description: string;
    quantity: string | number;
    unit_price: string | number;
    subtotal: string;
}

interface PublicInvoiceData {
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

export const PublicInvoicePage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [invoice, setInvoice] = useState<PublicInvoiceData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
    const invoicePaperRef = React.useRef<HTMLDivElement>(null);

    const handleDownloadPdf = async (): Promise<void> => {
        if (!invoicePaperRef.current || !invoice) return;
        try {
            setDownloadingPdf(true);
            await generateInvoicePdf({
                element: invoicePaperRef.current,
                filename: invoice.number || `invoice-${invoice.id}`,
            });
        } catch (err) {
            console.error('Failed to generate PDF', err);
        } finally {
            setDownloadingPdf(false);
        }
    };

    useEffect(() => {
        const fetchInvoice = async () => {
            if (!token) return;
            setLoading(true);
            setErrorMessage(null);
            try {
                const data = await invoiceApi.getPublicInvoice(token);
                setInvoice(data);
            } catch (err: any) {
                const detail =
                    err.response?.data?.detail ||
                    'Unable to load invoice. This link may be expired, revoked, or invalid.';
                setErrorMessage(detail);
            } finally {
                setLoading(false);
            }
        };

        fetchInvoice();
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
                    <span className="w-5 h-5 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin" />
                    <span>Loading invoice details...</span>
                </div>
            </div>
        );
    }

    if (errorMessage || !invoice) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">Link Inactive or Expired</h2>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        {errorMessage || 'This invoice link is no longer valid. Please contact the sender for a fresh invoice link.'}
                    </p>
                    <div className="pt-2">
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                        >
                            Return to Homepage
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const curr = invoice.currency || 'USD';
    const isPaid = invoice.status === 'PAID';
    const isOverdue =
        !isPaid &&
        new Date(invoice.due_date).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);

    return (
        <div className="min-h-screen bg-slate-100/70 py-10 px-4 sm:px-6 lg:px-8 font-sans print:bg-white print:p-0 print:min-h-0">
            <div className="max-w-3xl mx-auto space-y-6 print:space-y-4 print:max-w-none">
                {/* Security Verification & Print Bar */}
                <div className="flex items-center justify-between text-xs text-slate-500 bg-white/60 backdrop-blur-xs px-4 py-2.5 rounded-2xl border border-slate-200/60 print:hidden">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Cryptographically signed invoice link</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleDownloadPdf}
                            disabled={downloadingPdf}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 shadow-xs transition disabled:opacity-50"
                        >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>{downloadingPdf ? 'Exporting...' : 'Download PDF'}</span>
                        </button>
                        <span className="font-mono text-[11px] text-slate-400">Billable BD Security</span>
                    </div>
                </div>

                {/* Invoice Paper Document */}
                <div ref={invoicePaperRef} className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-10 space-y-8 print:shadow-none print:border-none print:p-0 print:space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-100">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Invoice
                            </span>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight mt-1">
                                {invoice.number || `INV-${invoice.id}`}
                            </h1>
                            <p className="text-xs text-slate-500 mt-1">
                                Issued: {formatDate(invoice.issue_date)}
                            </p>
                        </div>

                        {/* Status Badge */}
                        <div className="flex flex-col items-start sm:items-end gap-1.5">
                            {isPaid ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Paid in Full
                                </span>
                            ) : isOverdue ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <Clock className="w-3.5 h-3.5" />
                                    Past Due
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    <Clock className="w-3.5 h-3.5" />
                                    Payment Due
                                </span>
                            )}
                            <p className="text-xs text-slate-500">
                                Due date: <span className="font-semibold text-slate-700">{formatDate(invoice.due_date)}</span>
                            </p>
                        </div>
                    </div>

                    {/* Billed To / Parties */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
                        <div>
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Billed To
                            </h3>
                            <p className="font-bold text-slate-900 text-sm">{invoice.client_name}</p>
                            {invoice.client_email && (
                                <p className="text-xs text-slate-600 mt-0.5">{invoice.client_email}</p>
                            )}
                        </div>
                        <div className="sm:text-right">
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Amount Due
                            </h3>
                            <p className="font-mono text-2xl font-black text-slate-900">
                                {formatCurrency(invoice.balance_due, curr)}
                            </p>
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[11px]">
                                    <th className="py-3 font-semibold">Description</th>
                                    <th className="py-3 px-3 text-right font-semibold">Qty</th>
                                    <th className="py-3 px-3 text-right font-semibold">Rate</th>
                                    <th className="py-3 text-right font-semibold">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                {invoice.items && invoice.items.length > 0 ? (
                                    invoice.items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                            <td className="py-3 text-slate-900">{item.description}</td>
                                            <td className="py-3 px-3 text-right font-mono text-slate-600">
                                                {parseFloat(String(item.quantity))}
                                            </td>
                                            <td className="py-3 px-3 text-right font-mono text-slate-600">
                                                {formatCurrency(item.unit_price, curr)}
                                            </td>
                                            <td className="py-3 text-right font-mono font-semibold text-slate-900">
                                                {formatCurrency(item.subtotal, curr)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="py-4 text-center text-slate-400">
                                            No line items.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Totals */}
                    <div className="flex justify-end pt-4 border-t border-slate-100">
                        <div className="w-full sm:w-64 space-y-2 text-xs">
                            <div className="flex justify-between text-slate-600">
                                <span>Subtotal</span>
                                <span className="font-mono font-medium">
                                    {formatCurrency(invoice.subtotal, curr)}
                                </span>
                            </div>
                            {parseFloat(invoice.tax_amount || '0') > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Tax ({parseFloat(invoice.tax_rate)}%)</span>
                                    <span className="font-mono font-medium">
                                        {formatCurrency(invoice.tax_amount, curr)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-2 text-sm">
                                <span>Total</span>
                                <span className="font-mono">
                                    {formatCurrency(invoice.total_amount, curr)}
                                </span>
                            </div>
                            {parseFloat(invoice.paid_amount || '0') > 0 && (
                                <>
                                    <div className="flex justify-between text-emerald-700 font-medium">
                                        <span>Paid to date</span>
                                        <span className="font-mono">
                                            - {formatCurrency(invoice.paid_amount, curr)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-slate-900 font-bold text-sm bg-slate-50 p-2 rounded-xl">
                                        <span>Balance Due</span>
                                        <span className="font-mono text-amber-600">
                                            {formatCurrency(invoice.balance_due, curr)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Payment Notes / Wire Instructions */}
                    {invoice.notes && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-1">
                            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                                Payment Instructions / Notes
                            </h4>
                            <p className="text-slate-600 whitespace-pre-line leading-relaxed font-mono">
                                {invoice.notes}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Brand */}
                <div className="text-center text-xs text-slate-400 pb-8">
                    Powered by <span className="font-bold text-slate-600">Billable BD</span> — Freelance Financial Management
                </div>
            </div>
        </div>
    );
};

