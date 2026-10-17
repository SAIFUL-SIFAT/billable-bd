import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../api/notifications';
import type { NotificationItem } from '../types/notifications';
import { formatDate } from '../utils/formatters';

export const NotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const fetchNotifications = async () => {
        try {
            const data = await notificationApi.getNotifications({ page: 1 });
            setNotifications(data.results);
            const unread = data.results.filter((n) => !n.is_read).length;
            setUnreadCount(unread);
        } catch {
            // Silently ignore polling errors
        }
    };

    // 60-second polling as specified in Day 11 plan
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(() => {
            fetchNotifications();
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            await notificationApi.markRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
            setUnreadCount((c) => Math.max(0, c - 1));
        } catch {
            // Ignore
        }
    };

    const handleMarkAllRead = async () => {
        setLoading(true);
        try {
            await notificationApi.markAllRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } finally {
            setLoading(false);
        }
    };

    const handleNotificationClick = (item: NotificationItem) => {
        if (!item.is_read) {
            handleMarkAsRead(item.id);
        }
        if (item.invoice) {
            setIsOpen(false);
            navigate(`/invoices/${item.invoice}`);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                aria-label="Notifications"
            >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-950">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 mt-2 sm:w-80 md:w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded-full">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                disabled={loading}
                                onClick={handleMarkAllRead}
                                className="text-[11px] font-semibold text-slate-500 hover:text-amber-600 transition disabled:opacity-50"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-400">
                                No notifications yet.
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n)}
                                    className={`p-3.5 hover:bg-slate-50/80 transition cursor-pointer flex items-start gap-3 ${
                                        !n.is_read ? 'bg-amber-50/30' : ''
                                    }`}
                                >
                                    <div className="mt-0.5">
                                        {!n.is_read ? (
                                            <span className="w-2 h-2 rounded-full bg-amber-500 block" />
                                        ) : (
                                            <span className="w-2 h-2 rounded-full bg-transparent block" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs ${!n.is_read ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                                            {n.message}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                                            <Clock className="w-3 h-3" />
                                            <span>{formatDate(n.created_at)}</span>
                                            {n.invoice_number && (
                                                <span className="font-mono text-slate-500">
                                                    • {n.invoice_number}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {!n.is_read && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleMarkAsRead(n.id, e)}
                                            className="text-slate-400 hover:text-emerald-600 p-1 rounded transition"
                                            title="Mark as read"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
