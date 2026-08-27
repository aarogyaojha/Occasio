import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { Button, buttonVariants } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { verifyEmailMutation, resendVerificationMutation } = useAuth();
  const [resendEmail, setResendEmail] = useState('');

  useEffect(() => {
    if (token && !verifyEmailMutation.isSuccess && !verifyEmailMutation.isError && !verifyEmailMutation.isPending) {
      verifyEmailMutation.mutate(token);
    }
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    try {
      await resendVerificationMutation.mutateAsync(resendEmail);
    } catch {
      // Handled via resendVerificationMutation.error
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-sm p-8 space-y-6 font-mono">
        <header className="border-b border-zinc-800 pb-4 space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-white uppercase">
            Email Verification
          </h1>
          <p className="text-xs text-zinc-400">
            Verifying your Occasio account
          </p>
        </header>

        {!token && (
          <div className="space-y-4">
            <div className="p-3 bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs rounded-sm">
              [ERROR] No verification token provided.
            </div>
            <Link
              to="/login"
              className={buttonVariants({
                className:
                  'w-full text-center bg-zinc-100 text-zinc-950 font-bold uppercase tracking-wider py-2.5 px-4 text-xs rounded-sm hover:bg-zinc-300 transition-colors',
              })}
            >
              Go to Sign In
            </Link>
          </div>
        )}

        {token && verifyEmailMutation.isPending && (
          <div className="py-6 text-center text-xs text-zinc-400">
            Verifying your email token, please wait...
          </div>
        )}

        {verifyEmailMutation.isSuccess && (
          <div className="space-y-6">
            <div className="p-3 bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs rounded-sm">
              [SUCCESS] {verifyEmailMutation.data.message || 'Email verified successfully!'}
            </div>
            <p className="text-xs text-zinc-400">
              Your account is now fully verified. You can now log in to your Occasio account.
            </p>
            <Link
              to="/login"
              className={buttonVariants({
                className:
                  'w-full text-center bg-zinc-100 text-zinc-950 font-bold uppercase tracking-wider py-2.5 px-4 text-xs rounded-sm hover:bg-zinc-300 transition-colors',
              })}
            >
              Sign In Now
            </Link>
          </div>
        )}

        {verifyEmailMutation.isError && (
          <div className="space-y-6">
            <div className="p-3 bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs rounded-sm">
              [ERROR] {verifyEmailMutation.error.message || 'Verification token is invalid, expired, or already used.'}
            </div>

            {resendVerificationMutation.isSuccess ? (
              <div className="p-3 bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs rounded-sm">
                [SUCCESS] {resendVerificationMutation.data.message}
              </div>
            ) : (
              <form onSubmit={handleResend} className="space-y-3">
                <p className="text-xs text-zinc-400">
                  Need a new verification link? Enter your email address below to resend:
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="resendEmail" className="block text-zinc-300 uppercase tracking-wider text-[11px]">
                    Email Address
                  </Label>
                  <Input
                    id="resendEmail"
                    type="email"
                    placeholder="user@example.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-sm px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                  />
                </div>
                {resendVerificationMutation.error && (
                  <p className="text-zinc-400 text-[11px]">{resendVerificationMutation.error.message}</p>
                )}
                <Button
                  type="submit"
                  disabled={resendVerificationMutation.isPending || !resendEmail}
                  className="w-full bg-zinc-100 text-zinc-950 font-bold uppercase tracking-wider py-2 px-4 text-xs rounded-sm hover:bg-zinc-300 transition-colors disabled:opacity-50"
                >
                  {resendVerificationMutation.isPending ? 'Sending...' : 'Resend Verification Email'}
                </Button>
              </form>
            )}

            <div className="pt-2 border-t border-zinc-800 text-center text-xs">
              <Link to="/login" className="text-zinc-400 hover:text-zinc-100 underline">
                Return to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
