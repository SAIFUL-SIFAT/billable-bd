import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { ClientsPage } from './pages/ClientsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { TimeEntriesPage } from './pages/TimeEntriesPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { InvoiceFormPage } from './pages/InvoiceFormPage';
import { InvoiceFromTimePage } from './pages/InvoiceFromTimePage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { FiscalYearReportPage } from './pages/FiscalYearReportPage';
import { PublicInvoicePage } from './pages/PublicInvoicePage';
import { SettingsPage } from './pages/SettingsPage';
import { NotificationBell } from './components/NotificationBell';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Clock,
  FileText,
  BarChart3,
  LogOut,
  Menu,
  X,
  User,
  Settings,
} from 'lucide-react';

const NavigationHeader = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  if (!user) return null;

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/clients', label: 'Clients', icon: Users },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/time-entries', label: 'Time Entries', icon: Clock },
    { to: '/invoices', label: 'Invoices', icon: FileText },
    { to: '/reports/fiscal-year', label: 'Reports', icon: BarChart3 },
  ];

  const isActivePath = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-8">
          <Link to="/" className="flex items-center space-x-2.5 group">
            <img
              src="/logo-icon.svg"
              alt="Billable BD Logo"
              className="w-8 h-8 rounded-lg shadow-xs group-hover:scale-105 transition-transform"
            />
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              Billable <span className="text-amber-500">BD</span>
            </span>
          </Link>

          {/* Desktop Nav Links with Active State */}
          <nav className="hidden md:flex items-center space-x-1 text-xs font-semibold">
            {navLinks.map((link) => {
              const active = isActivePath(link.to);
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all ${active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Header: Notification Bell, Avatar Menu, Mobile Drawer Toggle */}
        <div className="flex items-center space-x-3">
          {/* Notification Bell Dropdown */}
          <NotificationBell />

          {/* Avatar Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAvatarMenu(!showAvatarMenu)}
              className="flex items-center p-0.5 rounded-full hover:ring-2 hover:ring-slate-300 transition focus:outline-none"
              aria-label="User menu"
            >
              {user.logo_url ? (
                <img
                  src={user.logo_url}
                  alt="Business Logo"
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {user.email.charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {/* Avatar Dropdown */}
            {showAvatarMenu && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2.5">
                  {user.logo_url ? (
                    <img
                      src={user.logo_url}
                      alt="Business Logo"
                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 truncate">{user.email}</div>
                    <div className="text-[11px] text-slate-500">Freelancer Account</div>
                  </div>
                </div>

                <div className="py-1">
                  <Link
                    to="/clients"
                    onClick={() => setShowAvatarMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Profile & Clients</span>
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setShowAvatarMenu(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 text-left"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Settings & Branding</span>
                  </Link>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAvatarMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Drawer Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
          >
            {mobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileDrawerOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-2">
          {/* Mobile User Profile Header */}
          <div className="flex items-center gap-2.5 pb-2.5 mb-2 border-b border-slate-100">
            {user.logo_url ? (
              <img
                src={user.logo_url}
                alt="Business Logo"
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {user.email.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate">{user.email}</div>
              <div className="text-[11px] text-slate-500">Freelancer Account</div>
            </div>
          </div>

          <div className="space-y-1">
            {navLinks.map((link) => {
              const active = isActivePath(link.to);
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Mobile Settings & Logout */}
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <Link
              to="/settings"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Settings & Branding</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setMobileDrawerOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-slate-50/50 flex flex-col antialiased text-slate-900">
            <NavigationHeader />
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/public/invoices/:token" element={<PublicInvoicePage />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reports/fiscal-year"
                  element={
                    <ProtectedRoute>
                      <FiscalYearReportPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clients"
                  element={
                    <ProtectedRoute>
                      <ClientsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <ProtectedRoute>
                      <ProjectsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/time-entries"
                  element={
                    <ProtectedRoute>
                      <TimeEntriesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices"
                  element={
                    <ProtectedRoute>
                      <InvoicesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices/new"
                  element={
                    <ProtectedRoute>
                      <InvoiceFormPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices/:id/edit"
                  element={
                    <ProtectedRoute>
                      <InvoiceFormPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices/from-time"
                  element={
                    <ProtectedRoute>
                      <InvoiceFromTimePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/invoices/:id"
                  element={
                    <ProtectedRoute>
                      <InvoiceDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </main>
          </div>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
