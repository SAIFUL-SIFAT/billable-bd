import React, { useState, useEffect } from 'react';
import { billingApi } from '../api/billing';
import { getProjects } from '../api/clients';
import type { TimeEntry, TimeEntryTotals } from '../types/billing';
import type { Project } from '../types/client';

export const TimeEntriesPage: React.FC = () => {
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [totals, setTotals] = useState<TimeEntryTotals>({ total_hours: 0, unbilled_hours: 0, unbilled_amount: 0 });
    const [loading, setLoading] = useState(true);

    // Quick-add form state
    const [selectedProject, setSelectedProject] = useState<number | ''>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [hoursInput, setHoursInput] = useState<number>(0);
    const [minutesInput, setMinutesInput] = useState<number>(0);
    const [description, setDescription] = useState<string>('');

    // Filters
    const [filterProject, setFilterProject] = useState<string>('');
    const [filterBilled, setFilterBilled] = useState<string>('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const params: Record<string, any> = {};
            if (filterProject) params.project = filterProject;
            if (filterBilled) params.is_billed = filterBilled;

            const [entriesRes, projectsRes, totalsRes] = await Promise.all([
                billingApi.getTimeEntries(params),
                getProjects(),
                billingApi.getTotals(params),
            ]);

            setEntries(entriesRes.results);
            setProjects(projectsRes.results);
            setTotals(totalsRes);
        } catch (err) {
            console.error('Failed to load time entries data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [filterProject, filterBilled]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProject) return;

        const totalDecimalHours = Number(hoursInput) + Number(minutesInput) / 60;
        if (totalDecimalHours <= 0) return;

        try {
            await billingApi.createTimeEntry({
                project: Number(selectedProject),
                date,
                hours: Number(totalDecimalHours.toFixed(2)),
                description,
            });
            setDescription('');
            setHoursInput(0);
            setMinutesInput(0);
            fetchData();
        } catch (err) {
            console.error('Failed to log time entry', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this time entry?')) return;
        try {
            await billingApi.deleteTimeEntry(id);
            fetchData();
        } catch (err) {
            console.error('Failed to delete time entry', err);
        }
    };

    const handleMinutesChange = (val: number) => {
        if (val < 0) {
            setMinutesInput(0);
            return;
        }
        if (val >= 60) {
            const extraHours = Math.floor(val / 60);
            const remainingMins = val % 60;
            setHoursInput((prev) => prev + extraHours);
            setMinutesInput(remainingMins);
        } else {
            setMinutesInput(val);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Time Entries</h1>
                {/* Unbilled Totals Banner */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex items-center space-x-6 text-sm">
                    <div>
                        <span className="text-gray-500">Unbilled Hours:</span>{' '}
                        <span className="font-semibold text-indigo-700">{totals.unbilled_hours} hrs</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Unbilled Amount:</span>{' '}
                        <span className="font-semibold text-emerald-700">
                            ৳{Number(totals.unbilled_amount).toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick-Add Form */}
            <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
                    <select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value ? Number(e.target.value) : '')}
                        className="w-full border-gray-300 rounded-md text-sm p-2 border"
                        required
                    >
                        <option value="">Select Project</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.client_name})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full border-gray-300 rounded-md text-sm p-2 border"
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Duration (H : M)</label>
                    <div className="flex space-x-1">
                        <input
                            type="number"
                            min="0"
                            placeholder="Hrs"
                            value={hoursInput || ''}
                            onChange={(e) => setHoursInput(Number(e.target.value))}
                            className="w-1/2 border-gray-300 rounded-md text-sm p-2 border"
                        />
                        <input
                            type="number"
                            min="0"
                            placeholder="Mins"
                            value={minutesInput || ''}
                            onChange={(e) => handleMinutesChange(Number(e.target.value))}
                            className="w-1/2 border-gray-300 rounded-md text-sm p-2 border"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                    <input
                        type="text"
                        placeholder="What did you work on?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full border-gray-300 rounded-md text-sm p-2 border"
                    />
                </div>
                <div>
                    <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md text-sm"
                    >
                        Log Time
                    </button>
                </div>
            </form>

            {/* Filter Toolbar */}
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-wrap gap-4 items-center text-sm">
                <span className="font-medium text-gray-700">Filter By:</span>
                <select
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                    className="border-gray-300 rounded-md text-sm p-1.5 border bg-white"
                >
                    <option value="">All Projects</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>

                <select
                    value={filterBilled}
                    onChange={(e) => setFilterBilled(e.target.value)}
                    className="border-gray-300 rounded-md text-sm p-1.5 border bg-white"
                >
                    <option value="">All Statuses</option>
                    <option value="false">Unbilled</option>
                    <option value="true">Billed</option>
                </select>
            </div>

            {/* Entries List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 text-sm">Loading time entries...</div>
                ) : entries.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No time entries logged yet.</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs font-medium uppercase">
                            <tr>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Project / Client</th>
                                <th className="px-4 py-3 text-left">Description</th>
                                <th className="px-4 py-3 text-right">Hours</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {entries.map((entry) => (
                                <tr key={entry.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-900">{entry.date}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900">{entry.project_name}</div>
                                        <div className="text-xs text-gray-500">{entry.client_name}</div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{entry.description || '-'}</td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-900">{entry.hours} hrs</td>
                                    <td className="px-4 py-3 text-center">
                                        {entry.is_billed ? (
                                            <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-medium">Billed</span>
                                        ) : (
                                            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">Unbilled</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {!entry.is_billed && (
                                            <button
                                                onClick={() => handleDelete(entry.id)}
                                                className="text-red-600 hover:text-red-800 text-xs font-medium"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

