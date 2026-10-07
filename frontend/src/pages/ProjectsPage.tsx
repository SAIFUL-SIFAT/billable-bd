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
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Projects</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    + Add Project
                </button>
            </div>

            <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border p-2 rounded w-full mb-4"
            />

            {loading ? (
                <p>Loading projects...</p>
            ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((p) => (
                        <div key={p.id} className="border p-4 rounded shadow">
                            <div className="flex justify-between">
                                <h3 className="font-bold text-lg">{p.name}</h3>
                                <span className="text-xs px-2 py-1 bg-gray-100 rounded uppercase">{p.billing_type}</span>
                            </div>
                            <p className="text-sm text-gray-600">Client: {p.client_name}</p>
                            <p className="text-sm font-semibold mt-2">
                                {p.billing_type === 'hourly' ? `${p.currency} ${p.hourly_rate}/hr` : `${p.currency} ${p.fixed_price} fixed`}
                            </p>
                            <button
                                onClick={() => handleDelete(p.id)}
                                className="mt-3 text-red-600 text-sm hover:underline"
                            >
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Add New Project</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium">Select Client</label>
                                <select
                                    value={clientId}
                                    onChange={e => setClientId(Number(e.target.value))}
                                    className="border w-full p-2 rounded"
                                    required
                                >
                                    <option value="">-- Choose Client --</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium">Project Name</label>
                                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="border w-full p-2 rounded" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium">Billing Type</label>
                                <select value={billingType} onChange={e => setBillingType(e.target.value as any)} className="border w-full p-2 rounded">
                                    <option value="hourly">Hourly Rate</option>
                                    <option value="fixed">Fixed Price</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium">
                                    {billingType === 'hourly' ? 'Hourly Rate' : 'Fixed Price'}
                                </label>
                                <input required type="number" step="0.01" value={rateOrPrice} onChange={e => setRateOrPrice(e.target.value)} className="border w-full p-2 rounded" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium">Currency</label>
                                <select value={currency} onChange={e => setCurrency(e.target.value as any)} className="border w-full p-2 rounded">
                                    <option value="BDT">BDT</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
