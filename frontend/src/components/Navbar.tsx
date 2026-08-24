import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, logoutMutation } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-zinc-950 border-b border-zinc-800 text-zinc-100 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between font-mono">
        <div className="flex items-center space-x-8">
          <Link
            to="/events"
            className="text-lg font-bold tracking-wider text-white hover:text-zinc-300 transition-colors uppercase"
          >
            Occasio
          </Link>
          <nav className="flex items-center space-x-4 text-xs uppercase tracking-wider">
            <Link
              to="/events"
              className={`px-3 py-1.5 rounded-sm border transition-colors ${
                isActive('/events')
                  ? 'border-zinc-100 text-zinc-100 bg-zinc-900 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-800'
              }`}
            >
              Events
            </Link>
            <Link
              to="/events/new"
              className={`px-3 py-1.5 rounded-sm border transition-colors ${
                isActive('/events/new')
                  ? 'border-zinc-100 text-zinc-100 bg-zinc-900 font-semibold'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              + New Event
            </Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          {user && (
            <span className="text-zinc-400 hidden md:inline-block border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 rounded-sm">
              <span className="text-zinc-500">User:</span> {user.name || user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="bg-zinc-100 text-zinc-950 hover:bg-zinc-300 font-bold uppercase px-3.5 py-1.5 rounded-sm transition-colors disabled:opacity-50 text-xs"
          >
            {logoutMutation.isPending ? 'Logging Out...' : 'Log Out'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
