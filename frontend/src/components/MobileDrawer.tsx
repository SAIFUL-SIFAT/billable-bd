import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  X,
  ChevronRight,
  User,
  Settings,
  LogOut,
  LayoutDashboard,
  Users,
  FolderKanban,
  Clock,
  FileText,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    email: string;
    logo_url?: string | null;
  } | null;
  logout: () => void;
}

const navLinks: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/time-entries', label: 'Time Entries', icon: Clock },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/expenses', label: 'Expenses', icon: CreditCard },
  { to: '/reports/fiscal-year', label: 'Fiscal Year Reports', icon: BarChart3 },
];

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  user,
  logout,
}) => {
  const location = useLocation();

  if (!user) return null;

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div
      className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over menu panel sliding smoothly from right with transform */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-xs sm:max-w-sm bg-white h-full shadow-2xl flex flex-col z-50 border-l border-slate-200 transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Top Header Bar matching modern design: "Menu" title + user icon + Close 'X' */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Menu
          </h2>
          <div className="flex items-center space-x-1">
            <Link
              to="/settings"
              onClick={onClose}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition"
              title="Profile & Settings"
            >
              <User className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Card */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
          {user.logo_url ? (
            <img
              src={user.logo_url}
              alt="Business Logo"
              className="w-9 h-9 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              {user.email.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 truncate">
              {user.email}
            </div>
            <div className="text-[11px] text-slate-500">
              Freelancer Account
            </div>
          </div>
        </div>

        {/* Navigation List in modern clean list style with ChevronRight */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-2">
            Explore
          </div>
          <div className="divide-y divide-slate-100">
            {navLinks.map((link) => {
              const active = isActivePath(link.to);
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={onClose}
                  className={`flex items-center justify-between py-3.5 px-3 rounded-xl text-sm font-semibold transition group ${
                    active
                      ? 'text-amber-600 bg-amber-50/50'
                      : 'text-slate-800 hover:text-slate-950 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-amber-500' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    <span>{link.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions: Settings & Logout */}
        <div className="p-4 border-t border-slate-100 bg-white space-y-1.5">
          <Link
            to="/settings"
            onClick={onClose}
            className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Settings & Branding</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};
