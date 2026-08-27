import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export const CheckEmailPage: React.FC = () => {
  const location = useLocation();
  const stateEmail = (location.state as { email?: string })?.email || '';
  const [emailInput, setEmailInput] = useState(stateEmail);
  const { resendVerificationMutation } = useAuth();

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    try {
      await resendVerificationMutation.mutateAsync(emailInput);
    } catch {
      // Handled via resendVerificationMutation.error
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-sm p-8 space-y-6 font-mono">
        <header className="border-b border-zinc-800 pb-4 space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-white uppercase font-mono">
            Check Your Inbox
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            Email verification required
          </p>
        </header>

        <div className="space-y-3 text-xs text-zinc-300">
          <p>
            We have sent a verification link to{' '}
            <strong className="text-zinc-100">{stateEmail || 'your email address'}</strong>.
          </p>
          <p className="text-zinc-400">
            Please check your inbox (and spam folder) and click the link to verify your account before logging in.
          </p>
        </div>

        {resendVerificationMutation.isSuccess && (
          <div className="p-3 bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono rounded-sm">
            [SUCCESS] {resendVerificationMutation.data.message}
          </div>
        )}

        {resendVerificationMutation.error && (
          <div className="p-3 bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono rounded-sm">
            [ERROR] {resendVerificationMutation.error.message}
          </div>
        )}

        <form onSubmit={handleResend} className="pt-2 space-y-3 border-t border-zinc-800/80">
          <p className="text-[11px] text-zinc-400">Didn&apos;t receive an email?</p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="user@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-sm px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
            />
            <Button
              type="submit"
              disabled={resendVerificationMutation.isPending || !emailInput}
              className="bg-zinc-100 text-zinc-950 font-bold uppercase tracking-wider px-3 py-2 text-xs rounded-sm hover:bg-zinc-300 transition-colors disabled:opacity-50"
            >
              {resendVerificationMutation.isPending ? 'Sending...' : 'Resend'}
            </Button>
          </div>
        </form>

        <footer className="pt-4 border-t border-zinc-800/80 text-center text-xs text-zinc-400">
          Ready to log in?{' '}
          <Link to="/login" className="text-zinc-100 underline hover:text-zinc-300">
            Go to Sign In
          </Link>
        </footer>
      </div>
    </div>
  );
};
