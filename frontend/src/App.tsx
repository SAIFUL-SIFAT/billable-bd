import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Billable BD</h1>
            <nav className="flex space-x-4">
              <Link to="/" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
              <Link to="/clients" className="text-gray-600 hover:text-gray-900">Clients</Link>
              <Link to="/login" className="text-gray-600 hover:text-gray-900">Login</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          <Routes>
            <Route path="/" element={<h2 className="text-2xl">Dashboard</h2>} />
            <Route path="/clients" element={<h2 className="text-2xl">Clients</h2>} />
            <Route path="/login" element={<h2 className="text-2xl">Login</h2>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
