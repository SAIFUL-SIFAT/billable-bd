import React, { useState, useEffect } from 'react';
import type { Project, Client } from '../types/client';
import { getProjects, createProject, getClients, deleteProject } from '../api/clients';

export const ProjectsPage: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const [clientId, setClientId] = useState<number | ''>('');
    const [name, setName] = useState('');
    const [billingType, setBillingType] = useState<'hourly' | 'fixed'>('hourly');
    const [rateOrPrice, setRateOrPrice] = useState('');
    const [currency, setCurrency] = useState<'BDT' | 'USD' | 'EUR' | 'GBP'>('BDT');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [projRes, clientRes] = await Promise.all([
                getProjects(search),
                getClients('')
            ]);
            setProjects(projRes.results);
            setClients(clientRes.results);
        } catch (err) {
            console.error("Failed to load project data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [search]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientId) {
            alert("Please select a client.");
            return;
        }

        const payload: Partial<Project> = {
            client: Number(clientId),
            name,
            billing_type: billingType,
            currency,
            hourly_rate: billingType === 'hourly' ? rateOrPrice : null,
            fixed_price: billingType === 'fixed' ? rateOrPrice : null,
        };

        try {
            await createProject(payload);
            setShowModal(false);
            setName('');
            setRateOrPrice('');
            fetchData();
        } catch (err) {
            alert("Failed to create project");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this project?")) return;
        try {
            await deleteProject(id);
            fetchData();
        } catch (err) {
            alert("Failed to delete project");
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Track billable engagements, billing structures (hourly vs fixed), and client assignments.
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all active:scale-[0.99]"
                >
                    <span className="text-base leading-none">+</span>
                    <span>Add Project</span>
                </button>
            </div>

            {/* Search Toolbar */}
            <div className="relative max-w-md">
                <input
                    type="text"
                    placeholder="Search projects..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-4 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-sm transition-all"
                />
            </div>

            {/* Projects Grid */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                </div>
            ) : projects.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
                    <p className="text-slate-500 text-sm">No projects found matching your search.</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-block mt-3 text-amber-600 hover:text-amber-700 text-sm font-medium"
                    >
                        Create your first project &rarr;
                    </button>
                </div>
            ) : (
                <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((p) => (
                        <div
                            key={p.id}
                            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="font-bold text-base text-slate-900 tracking-tight">{p.name}</h3>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                                        p.billing_type === 'hourly'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                    }`}>
                                        {p.billing_type}
                                    </span>
                                </div>
                                <p className="text-xs font-medium text-slate-500 mb-4">
                                    Client: <span className="text-slate-700">{p.client_name || `Client #${p.client}`}</span>
                                </p>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-baseline justify-between">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Rate:</span>
                                    <span className="text-sm font-bold text-slate-900">
                                        {p.billing_type === 'hourly'
                                            ? `${p.currency} ${p.hourly_rate} / hr`
                                            : `${p.currency} ${p.fixed_price} fixed`}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-xs text-slate-400">ID #{p.id}</span>
                                <button
                                    onClick={() => handleDelete(p.id)}
                                    className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Project Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold text-slate-900">Add New Project</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-semibold w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Select Client *</label>
                                <select
                                    value={clientId}
                                    onChange={e => setClientId(Number(e.target.value))}
                                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    required
                                >
                                    <option value="">-- Choose Client --</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Project Name *</label>
                                <input
                                    required
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Website Redesign"
                                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Billing Type</label>
                                    <select
                                        value={billingType}
                                        onChange={e => setBillingType(e.target.value as any)}
                                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    >
                                        <option value="hourly">Hourly Rate</option>
                                        <option value="fixed">Fixed Price</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Currency</label>
                                    <select
                                        value={currency}
                                        onChange={e => setCurrency(e.target.value as any)}
                                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                    >
                                        <option value="BDT">BDT (৳)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                        <option value="GBP">GBP (£)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    {billingType === 'hourly' ? 'Hourly Rate *' : 'Fixed Price *'}
                                </label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    value={rateOrPrice}
                                    onChange={e => setRateOrPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                                />
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-all"
                                >
                                    Save Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
