import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';

export const EventsPlaceholder: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, logoutMutation } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 selection:bg-zinc-100 selection:text-zinc-950">
      <main className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-sm p-8 space-y-6">
        <header className="border-b border-zinc-800 pb-5 space-y-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase font-mono">
              Events Dashboard
            </h1>
            <span className="text-xs uppercase tracking-widest font-mono text-zinc-400 border border-zinc-800 px-2.5 py-1 rounded-sm bg-zinc-950">
              Authenticated
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-mono">
            Placeholder interface — real events UI is the next module
          </p>
        </header>

        <section className="space-y-4 font-mono text-xs">
          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-sm space-y-2">
            <h2 className="text-zinc-500 uppercase tracking-wider text-[11px]">
              Active Session Details
            </h2>
            <div className="space-y-1 text-zinc-300">
              <p>
                <span className="text-zinc-500">User ID:</span> {user?.id ?? 'N/A'}
              </p>
              <p>
                <span className="text-zinc-500">Name:</span> {user?.name ?? 'N/A'}
              </p>
              <p>
                <span className="text-zinc-500">Email:</span> {user?.email ?? 'N/A'}
              </p>
              {user?.created_at && (
                <p>
                  <span className="text-zinc-500">Joined:</span> {new Date(user.created_at as string).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="p-4 border border-zinc-800/80 bg-zinc-950 rounded-sm">
            <p className="text-zinc-300 leading-relaxed">
              You are successfully logged in! Session state is synchronized with the backend via HTTP-only refresh cookies and in-memory Zustand access tokens.
            </p>
          </div>
        </section>

        <footer className="pt-4 border-t border-zinc-800 flex items-center justify-between font-mono text-xs">
          <span className="text-zinc-500">Status: Ready</span>
          <button
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="bg-zinc-100 text-zinc-950 font-bold uppercase px-4 py-2 rounded-sm hover:bg-zinc-300 transition-colors disabled:opacity-50"
          >
            {logoutMutation.isPending ? 'Logging Out...' : 'Log Out'}
          </button>
        </footer>
      </main>
    </div>
  );
};

export default EventsPlaceholder;
