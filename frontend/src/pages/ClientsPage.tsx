import React, { useState, useEffect } from 'react';
import type { Client } from '../types/client';
import { getClients, createClient, deleteClient } from '../api/clients';

export const ClientsPage: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [company, setCompany] = useState('');
    const [currency, setCurrency] = useState<'BDT' | 'USD' | 'EUR' | 'GBP'>('BDT');

    const fetchClients = async () => {
        setLoading(true);
        try {
            const res = await getClients(search);
            setClients(res.results);
        } catch (err) {
            console.error("Failed to load clients", err);
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
            alert("Error creating client");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this client?")) return;
        try {
            await deleteClient(id);
            fetchClients();
        } catch (err) {
            alert("Failed to delete client");
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Clients</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    + Add Client
                </button>
            </div>

            <input
                type="text"
                placeholder="Search clients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border p-2 rounded w-full mb-4"
            />

            {loading ? (
                <p>Loading clients...</p>
            ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {clients.map((c) => (
                        <div key={c.id} className="border p-4 rounded shadow">
                            <h3 className="font-bold text-lg">{c.name}</h3>
                            <p className="text-gray-600">{c.company || 'No Company'}</p>
                            <p className="text-sm text-gray-500">{c.email}</p>
                            <p className="text-sm text-gray-500">Currency: {c.default_currency}</p>
                            <button
                                onClick={() => handleDelete(c.id)}
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
                        <h2 className="text-xl font-bold mb-4">Add New Client</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium">Client Name</label>
                                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="border w-full p-2 rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Company</label>
                                <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="border w-full p-2 rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border w-full p-2 rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Default Currency</label>
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
