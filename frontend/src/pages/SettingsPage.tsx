import React, { useState, useEffect, useRef } from 'react';
import {
    Building2,
    Upload,
    Trash2,
    Check,
    AlertCircle,
    FileImage,
    ShieldCheck,
    Receipt,
    MapPin,
    Hash,
    Loader2
} from 'lucide-react';
import { profileApi, type ProfileData } from '../api/profile';
import { getApiErrorMessage } from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
    const toast = useToast();
    const { refetchUser } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [profile, setProfile] = useState<ProfileData | null>(null);

    const [businessName, setBusinessName] = useState('');
    const [businessAddress, setBusinessAddress] = useState('');
    const [taxNumber, setTaxNumber] = useState('');
    const [taxPresetsInput, setTaxPresetsInput] = useState('');
    const [customRate, setCustomRate] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            setErrorMsg(null);
            const data = await profileApi.getProfile();
            setProfile(data);
            setBusinessName(data.business_name || '');
            setBusinessAddress(data.business_address || '');
            setTaxNumber(data.tax_number || '');
            setTaxPresetsInput((data.tax_rate_presets || [0, 5, 10, 15]).join(', '));
            setCustomRate(data.custom_exchange_rate || '');
        } catch (err) {
            const msg = getApiErrorMessage(err);
            setErrorMsg(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleSaveMetadata = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            setErrorMsg(null);

            const parsedPresets = taxPresetsInput
                .split(',')
                .map((s) => parseFloat(s.trim()))
                .filter((n) => !isNaN(n) && n >= 0);

            const updated = await profileApi.updateProfile({
                business_name: businessName,
                business_address: businessAddress,
                tax_number: taxNumber,
                tax_rate_presets: parsedPresets,
                custom_exchange_rate: customRate.trim() ? customRate.trim() : null,
            });
            setProfile(updated);
            toast.success('Business settings and tax/rate presets saved.');
        } catch (err) {
            const msg = getApiErrorMessage(err);
            setErrorMsg(msg);
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Client-side pre-validation
        if (file.size > 2 * 1024 * 1024) {
            const msg = `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds 2MB limit.`;
            setErrorMsg(msg);
            toast.error(msg);
            return;
        }

        try {
            setUploadingLogo(true);
            setErrorMsg(null);
            const updated = await profileApi.uploadLogo(file);
            setProfile(updated);
            await refetchUser();
            toast.success('Company logo uploaded and verified successfully.');
        } catch (err) {
            const msg = getApiErrorMessage(err);
            setErrorMsg(msg);
            toast.error(msg);
        } finally {
            setUploadingLogo(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteLogo = async () => {
        if (!confirm('Are you sure you want to remove your company logo?')) return;
        try {
            setUploadingLogo(true);
            setErrorMsg(null);
            const updated = await profileApi.deleteLogo();
            setProfile(updated);
            await refetchUser();
            toast.success('Company logo removed.');
        } catch (err) {
            const msg = getApiErrorMessage(err);
            setErrorMsg(msg);
            toast.error(msg);
        } finally {
            setUploadingLogo(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
                <p className="text-sm font-medium">Loading settings & profile...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-16">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                    Business Profile & Settings
                </h1>
                <p className="mt-1.5 text-sm text-slate-600">
                    Manage your freelancer branding, invoice header information, and official company logo.
                </p>
            </div>

            {/* Error Banner */}
            {errorMsg && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-sm font-medium leading-relaxed">{errorMsg}</div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column: Logo & Branding Card */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                            <FileImage className="w-4 h-4 text-amber-500" />
                            <h2>Company Logo</h2>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            This logo will appear on top of your generated invoices and public client links.
                        </p>

                        {/* Logo Preview Container */}
                        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/60 min-h-[160px] text-center">
                            {profile?.logo_url ? (
                                <div className="space-y-3">
                                    <img
                                        src={profile.logo_url}
                                        alt="Business Logo"
                                        className="max-h-24 max-w-full object-contain mx-auto rounded-lg shadow-2xs"
                                    />
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                        Verified Raster
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-2xs">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <p className="text-xs font-semibold text-slate-600">No logo uploaded yet</p>
                                    <p className="text-[11px] text-slate-400">PNG, JPG, or WEBP up to 2MB</p>
                                </div>
                            )}
                        </div>

                        {/* Upload / Delete Actions */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleLogoSelect}
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                        />

                        <div className="flex flex-col gap-2 pt-1">
                            <button
                                type="button"
                                disabled={uploadingLogo}
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-50"
                            >
                                {uploadingLogo ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4" />
                                )}
                                <span>{profile?.logo_url ? 'Replace Logo' : 'Upload Logo'}</span>
                            </button>

                            {profile?.logo_url && (
                                <button
                                    type="button"
                                    disabled={uploadingLogo}
                                    onClick={handleDeleteLogo}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 text-xs font-semibold transition disabled:opacity-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remove Logo</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Invoice Sender Metadata Form */}
                <div className="md:col-span-2">
                    <form
                        onSubmit={handleSaveMetadata}
                        className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6"
                    >
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-base border-b border-slate-100 pb-4">
                            <Receipt className="w-4 h-4 text-amber-500" />
                            <h2>Invoice Header Details</h2>
                        </div>

                        {/* Business / Freelancer Legal Name */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                <span>Business or Trading Name</span>
                            </label>
                            <input
                                type="text"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="e.g. Rahim Software Labs / Saiful Freelance"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
                            />
                            <p className="text-[11px] text-slate-400">
                                Displayed as the sender organization on all client invoices.
                            </p>
                        </div>

                        {/* Physical / Mailing Address */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>Business Address</span>
                            </label>
                            <textarea
                                rows={3}
                                value={businessAddress}
                                onChange={(e) => setBusinessAddress(e.target.value)}
                                placeholder="House 12, Road 4, Dhanmondi, Dhaka-1209, Bangladesh"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition resize-none"
                            />
                        </div>

                        {/* Tax / BIN Identification */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <Hash className="w-3.5 h-3.5 text-slate-400" />
                                <span>Tax Identification / BIN Number</span>
                            </label>
                            <input
                                type="text"
                                value={taxNumber}
                                onChange={(e) => setTaxNumber(e.target.value)}
                                placeholder="e.g. BIN-0012345678 or e-TIN 123456789012"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
                            />
                            <p className="text-[11px] text-slate-400">
                                Optional tax registration number printed on formal invoice receipts.
                            </p>
                        </div>

                        {/* Tax Rate Presets (US-26) */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <span>Tax Rate Presets (%)</span>
                            </label>
                            <input
                                type="text"
                                value={taxPresetsInput}
                                onChange={(e) => setTaxPresetsInput(e.target.value)}
                                placeholder="e.g. 0, 5, 10, 15"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-mono"
                            />
                            <p className="text-[11px] text-slate-400">
                                Comma-separated percentages (e.g. 0, 5, 15) available as one-click chips during invoice drafting.
                            </p>
                        </div>

                        {/* Custom BDT Exchange Rate Override (US-27) */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <span>Custom BDT Exchange Rate Override (৳ per USD)</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={customRate}
                                onChange={(e) => setCustomRate(e.target.value)}
                                placeholder="e.g. 125.00 (leave blank to use live market rate)"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-mono"
                            />
                            <p className="text-[11px] text-slate-400">
                                Override live conversion rates to estimate pending receivables in BDT at your target payout rate.
                            </p>
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4 border-t border-slate-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition disabled:opacity-50 shadow-xs"
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                <span>Save Business Settings</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
