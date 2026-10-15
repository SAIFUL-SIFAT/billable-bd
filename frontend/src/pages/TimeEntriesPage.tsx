import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { billingApi } from '../api/billing';
import { getProjects } from '../api/clients';
import type { TimeEntry, TimeEntryTotals } from '../types/billing';
import type { Project } from '../types/client';
import { formatDate } from '../utils/formatters';
import { Money } from '../components/Money';
import { 
    Clock, 
    Trash2, 
    Lock, 
    Calendar, 
    ArrowRight
} from 'lucide-react';

export const TimeEntriesPage: React.FC = () => {
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [totals, setTotals] = useState<TimeEntryTotals>({ total_hours: 0, unbilled_hours: 0, unbilled_amount: 0 });
    const [loading, setLoading] = useState(true);

    // Form remembers last project and keeps date to today by default
    const [selectedProject, setSelectedProject] = useState<number | ''>(() => {
        const saved = localStorage.getItem('last_project_id');
        return saved ? Number(saved) : '';
    });
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [hoursInput, setHoursInput] = useState<number>(0);
    const [minutesInput, setMinutesInput] = useState<number>(0);
    const [description, setDescription] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Filters and views
    const [filterProject, setFilterProject] = useState<string>('');
    const [filterBilled, setFilterBilled] = useState<string>('');
    const [viewMode, setViewMode] = useState<'list' | 'weekly'>('list');

    const fetchData = async () => {
        setLoading(true);
        try {
            const params: Record<string, any> = {};
            if (filterProject) params.project = filterProject;
            if (filterBilled) params.is_billed = filterBilled;

            const [entriesRes, projectsRes, totalsRes] = await Promise.all([
                billingApi.getTimeEntries(params).catch(() => ({ results: [], count: 0 })),
                getProjects().catch(() => ({ results: [], count: 0 })),
                billingApi.getTotals(params).catch(() => ({ total_hours: 0, unbilled_hours: 0, unbilled_amount: 0 })),
            ]);

            setEntries(entriesRes.results || []);
            setProjects(projectsRes.results || []);
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

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedProject || submitting) return;

        const totalDecimalHours = Number(hoursInput) + Number(minutesInput) / 60;
        if (totalDecimalHours <= 0) return;

        setSubmitting(true);
        try {
            await billingApi.createTimeEntry({
                project: Number(selectedProject),
                date,
                hours: Number(totalDecimalHours.toFixed(2)),
                description: description.trim() || undefined,
            });

            // Remember last selected project in localStorage
            localStorage.setItem('last_project_id', String(selectedProject));

            // Reset inputs but preserve project and date for fast batch logging
            setDescription('');
            setHoursInput(0);
            setMinutesInput(0);
            await fetchData();
        } catch (err) {
            console.error('Failed to log time entry', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this unbilled time entry?')) return;
        try {
            await billingApi.deleteTimeEntry(id);
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.detail || 'Failed to delete time entry.');
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

    // Calculate weekly grouped entries
    const getWeekKey = (dateStr: string) => {
        const parts = dateStr.split('T')[0].split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    };

    const weeklyGroups = entries.reduce<Record<string, TimeEntry[]>>((acc, entry) => {
        const weekKey = getWeekKey(entry.date);
        if (!acc[weekKey]) acc[weekKey] = [];
        acc[weekKey].push(entry);
        return acc;
    }, {});

    const sortedWeeks = Object.keys(weeklyGroups).sort((a, b) => b.localeCompare(a));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Time Entries</h1>
                    <p className="text-sm text-slate-600 mt-1">
                        Log billable work, monitor unbilled totals, and convert unbilled hours to invoices.
                    </p>
                </div>

                {/* Unbilled Totals Banner with direct CTA */}
                <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs">
                    <div className="flex items-center gap-5">
                        <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">Filtered Total</span>
                            <span className="font-bold text-slate-900 text-sm">{totals.total_hours} hrs</span>
                        </div>
                        <div className="h-7 w-px bg-slate-200"></div>
                        <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">Unbilled Time</span>
                            <span className="font-bold text-slate-900 text-sm">{totals.unbilled_hours} hrs</span>
                        </div>
                        {totals.unbilled_by_currency && totals.unbilled_by_currency.length > 0 && (
                            <>
                                <div className="h-7 w-px bg-slate-200"></div>
                                <div>
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">Unbilled Value</span>
                                    <div className="flex flex-col">
                                        {totals.unbilled_by_currency.map((c) => (
                                            <Money 
                                                key={c.currency}
                                                amount={c.amount} 
                                                currency={c.currency} 
                                                numberClassName="font-extrabold text-emerald-700 text-xs" 
                                            />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {totals.unbilled_hours > 0 && (
                        <Link
                            to="/invoices/from-time"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition whitespace-nowrap active:scale-[0.99]"
                        >
                            <span>Create invoice from unbilled time</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    )}
                </div>
            </div>

            {/* Quick-Add Form Card (Press Enter in inputs to submit) */}
            <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Quick Log Time Entry</span>
                </div>
                <form 
                    onSubmit={handleSubmit} 
                    className="grid grid-cols-1 md:grid-cols-6 gap-3.5 items-end"
                >
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Project *</label>
                        <select
                            value={selectedProject}
                            onChange={(e) => setSelectedProject(e.target.value ? Number(e.target.value) : '')}
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            required
                        >
                            <option value="">Select Project</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>{p.name} ({p.client_name}) - {p.currency} {p.hourly_rate ? `@${p.hourly_rate}/hr` : ''}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Duration (H : M)</label>
                        <div className="flex space-x-1.5">
                            <input
                                type="number"
                                min="0"
                                placeholder="Hrs"
                                value={hoursInput || ''}
                                onChange={(e) => setHoursInput(Number(e.target.value))}
                                className="w-1/2 px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
                            />
                            <input
                                type="number"
                                min="0"
                                placeholder="Mins"
                                value={minutesInput || ''}
                                onChange={(e) => handleMinutesChange(Number(e.target.value))}
                                className="w-1/2 px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono transition-all"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Description</label>
                        <input
                            type="text"
                            placeholder="What did you work on? (Enter to submit)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2 px-4 rounded-xl text-xs shadow-xs transition-all active:scale-[0.99] disabled:opacity-50"
                        >
                            {submitting ? 'Logging...' : 'Log Time'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Filter Toolbar & View Mode Switcher */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap justify-between items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500 uppercase tracking-wider mr-1">Filter:</span>
                    <select
                        value={filterProject}
                        onChange={(e) => setFilterProject(e.target.value)}
                        className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                        <option value="">All Projects</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>

                    <select
                        value={filterBilled}
                        onChange={(e) => setFilterBilled(e.target.value)}
                        className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                        <option value="">All Statuses</option>
                        <option value="false">Unbilled</option>
                        <option value="true">Billed</option>
                    </select>
                </div>

                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Standard List
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('weekly')}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            viewMode === 'weekly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Weekly Grouped
                    </button>
                </div>
            </div>

            {/* Entries Display */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-600 text-xs flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></div>
                        <span>Loading time entries...</span>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 text-xs">No time entries logged yet.</div>
                ) : viewMode === 'list' ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-3.5 text-left">Date</th>
                                    <th className="px-5 py-3.5 text-left">Project / Client</th>
                                    <th className="px-5 py-3.5 text-left">Description</th>
                                    <th className="px-5 py-3.5 text-right">Hours</th>
                                    <th className="px-5 py-3.5 text-center">Status</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {entries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-5 py-3.5 text-slate-900 font-mono text-xs">{formatDate(entry.date)}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="font-semibold text-slate-900 text-xs">{entry.project_name}</div>
                                            <div className="text-[11px] text-slate-500">{entry.client_name}</div>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600 text-xs">{entry.description || '-'}</td>
                                        <td className="px-5 py-3.5 text-right font-semibold text-slate-900 font-mono text-xs">{entry.hours} hrs</td>
                                        <td className="px-5 py-3.5 text-center">
                                            {entry.is_billed ? (
                                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                                                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                                                    <span>Billed</span>
                                                </span>
                                            ) : (
                                                <span className="bg-amber-50 text-amber-700 border border-amber-200/60 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                                                    Unbilled
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            {entry.is_billed ? (
                                                <span className="text-slate-400 text-xs flex items-center justify-end gap-1" title="Locked on Invoice">
                                                    <Lock className="w-3.5 h-3.5" />
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleDelete(entry.id)}
                                                    className="text-rose-600 hover:text-rose-800 text-xs font-medium hover:bg-rose-50 p-1 rounded-lg transition-colors"
                                                    title="Delete entry"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {sortedWeeks.map((weekStart) => {
                            const groupEntries = weeklyGroups[weekStart];
                            const weekTotalHours = groupEntries.reduce((sum, e) => sum + parseFloat(e.hours), 0);

                            return (
                                <div key={weekStart} className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <span className="font-bold text-xs text-slate-900">
                                                Week of {formatDate(weekStart)}
                                            </span>
                                        </div>
                                        <div className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                                            {weekTotalHours.toFixed(2)} hrs logged
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        {groupEntries.map((e) => (
                                            <div key={e.id} className="flex items-center justify-between py-2 px-3 bg-slate-50/70 rounded-xl text-xs">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-slate-500">{formatDate(e.date)}</span>
                                                    <span className="font-semibold text-slate-900">{e.project_name}</span>
                                                    <span className="text-slate-500">{e.description || '-'}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono font-bold text-slate-900">{e.hours} hrs</span>
                                                    {e.is_billed ? (
                                                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleDelete(e.id)}
                                                            className="text-slate-400 hover:text-rose-600"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
