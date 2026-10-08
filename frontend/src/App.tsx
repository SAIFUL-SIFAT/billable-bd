import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { ClientsPage } from './pages/ClientsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { TimeEntriesPage } from './pages/TimeEntriesPage';

const NavigationHeader = () => {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
        <div className="flex items-center space-x-8">
          <Link to="/" className="font-bold text-xl text-indigo-600">Billable BD</Link>
          <nav className="flex space-x-4 text-sm font-medium">
            <Link to="/clients" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md">Clients</Link>
            <Link to="/projects" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md">Projects</Link>
            <Link to="/time-entries" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md">Time Entries</Link>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-700">{user.email}</span>
          <button
            onClick={logout}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md font-medium"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <NavigationHeader />
          <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><TimeEntriesPage /></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
              <Route path="/time-entries" element={<ProtectedRoute><TimeEntriesPage /></ProtectedRoute>} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

