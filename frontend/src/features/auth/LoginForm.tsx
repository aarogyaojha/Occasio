import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import { loginSchema, type LoginInput } from './schemas';
import { useAuth } from './useAuth';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { loginMutation, resendVerificationMutation, verifyTwoFactorLoginMutation } = useAuth();
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState<string>('');

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      const response = await loginMutation.mutateAsync(data);
      if (response.requiresTwoFactor) {
        setChallengeToken(response.challengeToken);
      } else {
        navigate('/events', { replace: true });
      }
    } catch {
      // Error handled via loginMutation.error
    }
  };

  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken || !totpCode.trim()) return;

    try {
      await verifyTwoFactorLoginMutation.mutateAsync({
        challengeToken,
        code: totpCode.trim(),
      });
      navigate('/events', { replace: true });
    } catch {
      // Error handled via verifyTwoFactorLoginMutation.error
    }
  };

  const handleResend = async () => {
    const email = getValues('email');
    if (!email) return;
    try {
      await resendVerificationMutation.mutateAsync(email);
    } catch {
      // Error handled via resendVerificationMutation.error
    }
  };

  const isEmailNotVerified = loginMutation.error?.code === 'EMAIL_NOT_VERIFIED';
  const errorMessage = loginMutation.error?.message;
  const twoFactorErrorMessage = verifyTwoFactorLoginMutation.error?.message;

  if (challengeToken) {
    return (
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-sm p-8 space-y-6">
        <header className="border-b border-zinc-800 pb-4 space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-white uppercase font-mono">
            Two-Factor Authentication
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            Enter the 6-digit verification code from your authenticator app
          </p>
        </header>

        {twoFactorErrorMessage && (
          <div className="p-3 bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono rounded-sm">
            [ERROR] {twoFactorErrorMessage}
          </div>
        )}

        <form onSubmit={handleVerifyTwoFactor} className="space-y-4 font-mono text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="totpCode" className="block text-zinc-300 uppercase tracking-wider text-xs font-mono">
              6-Digit Security Code
            </Label>
            <Input
              id="totpCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="w-full bg-zinc-950 border-zinc-800 text-zinc-100 text-center text-lg tracking-widest font-mono h-10"
              autoFocus
            />
          </div>

          <Button
            type="submit"
            disabled={verifyTwoFactorLoginMutation.isPending || totpCode.trim().length !== 6}
            className="w-full mt-2 bg-zinc-100 text-zinc-950 font-bold uppercase tracking-wider py-2.5 rounded-sm hover:bg-zinc-300 transition-colors disabled:opacity-50 font-mono text-xs h-10"
          >
            {verifyTwoFactorLoginMutation.isPending ? 'Verifying Code...' : 'Verify & Sign In'}
          </Button>
        </form>

        <footer className="pt-4 border-t border-zinc-800/80 text-center font-mono text-xs">
          <button
            type="button"
            onClick={() => {
              setChallengeToken(null);
              setTotpCode('');
            }}
            className="text-zinc-400 hover:text-zinc-100 underline"
          >
            Back to Sign In
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-sm p-8 space-y-6">
      <header className="border-b border-zinc-800 pb-4 space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-white uppercase font-mono">
          Sign In
        </h1>
        <p className="text-xs text-zinc-400 font-mono">
          Enter your credentials to access your account
        </p>
      </header>

      {errorMessage && (
        <div className="p-3 bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono rounded-sm space-y-2">
          <div>[ERROR] {errorMessage}</div>
          {isEmailNotVerified && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendVerificationMutation.isPending}
              className="mt-1 text-xs text-zinc-100 underline hover:text-zinc-300 font-mono font-bold block"
            >
              {resendVerificationMutation.isPending
                ? 'Sending verification link...'
                : 'Resend verification email'}
            </button>
          )}
        </div>
      )}

      {resendVerificationMutation.isSuccess && (
        <div className="p-3 bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-mono rounded-sm">
          [SUCCESS] {resendVerificationMutation.data.message}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 font-mono text-xs">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-zinc-300 uppercase tracking-wider">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            placeholder="user@example.com"
            {...register('email')}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-sm px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          {errors.email && (
            <p className="text-zinc-400 text-[11px] mt-1">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-zinc-300 uppercase tracking-wider">
            Password
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            {...register('password')}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-sm px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          {errors.password && (
            <p className="text-zinc-400 text-[11px] mt-1">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full mt-2 bg-zinc-100 text-zinc-950 font-bold uppercase tracking-wider py-2.5 px-4 rounded-sm hover:bg-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <footer className="pt-4 border-t border-zinc-800/80 text-center font-mono text-xs text-zinc-400">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="text-zinc-100 underline hover:text-zinc-300">
          Sign up
        </Link>
      </footer>
    </div>
  );
};
