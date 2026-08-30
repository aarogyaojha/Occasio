import React, { useState } from 'react';
import { useAuth } from '../features/auth/useAuth';
import { getMe } from '../api/auth';
import { useAuthStore } from '../features/auth/authStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';

export const SettingsPage: React.FC = () => {
  const { user, setupTwoFactorMutation, enableTwoFactorMutation, disableTwoFactorMutation } =
    useAuth();
  const setAuth = useAuthStore((state) => state.setAuth);
  const accessToken = useAuthStore((state) => state.accessToken);

  // Setup state
  const [setupData, setSetupData] = useState<{ qrCodeDataUrl: string; secret: string } | null>(
    null
  );
  const [enableCode, setEnableCode] = useState<string>('');

  // Disable dialog state
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState<boolean>(false);
  const [disableCode, setDisableCode] = useState<string>('');

  const refreshUserProfile = async () => {
    try {
      const updatedUser = await getMe();
      if (accessToken) {
        setAuth(updatedUser, accessToken);
      }
    } catch {
      // User profile sync fallback
    }
  };

  const handleStartSetup = async () => {
    try {
      const result = await setupTwoFactorMutation.mutateAsync();
      setSetupData(result);
      setEnableCode('');
    } catch {
      // Handled by setupTwoFactorMutation.error
    }
  };

  const handleConfirmEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enableCode.trim()) return;

    try {
      await enableTwoFactorMutation.mutateAsync(enableCode.trim());
      setSetupData(null);
      setEnableCode('');
      await refreshUserProfile();
    } catch {
      // Handled by enableTwoFactorMutation.error
    }
  };

  const handleConfirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disableCode.trim()) return;

    try {
      await disableTwoFactorMutation.mutateAsync(disableCode.trim());
      setIsDisableDialogOpen(false);
      setDisableCode('');
      await refreshUserProfile();
    } catch {
      // Handled by disableTwoFactorMutation.error
    }
  };

  const isTwoFactorEnabled = Boolean(user?.totp_enabled);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-mono text-xs space-y-8">
      <header className="border-b border-zinc-800 pb-4 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-white uppercase">
          Account Settings
        </h1>
        <p className="text-zinc-400">
          Manage your security preferences and two-factor authentication
        </p>
      </header>

      {/* Profile summary */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200 border-b border-zinc-800 pb-2">
          Profile Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-zinc-300">
          <div>
            <span className="text-zinc-500 uppercase tracking-wider block text-[11px]">Name:</span>
            <span className="text-white text-sm font-semibold">{user?.name}</span>
          </div>
          <div>
            <span className="text-zinc-500 uppercase tracking-wider block text-[11px]">Email:</span>
            <span className="text-white text-sm font-semibold">{user?.email}</span>
          </div>
        </div>
      </section>

      {/* 2FA Section */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-100">
                Two-Factor Authentication (2FA)
              </h2>
              <Badge
                variant={isTwoFactorEnabled ? 'outline' : 'secondary'}
                className={
                  isTwoFactorEnabled
                    ? 'border-zinc-400 text-zinc-100 bg-zinc-800 uppercase font-mono'
                    : 'bg-zinc-800 text-zinc-400 uppercase font-mono'
                }
              >
                {isTwoFactorEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <p className="text-zinc-400 text-xs">
              TOTP-based two-factor authentication, compatible with any standard authenticator app
            </p>
          </div>

          {!isTwoFactorEnabled && !setupData && (
            <Button
              onClick={handleStartSetup}
              disabled={setupTwoFactorMutation.isPending}
              className="bg-zinc-100 text-zinc-950 hover:bg-zinc-300 font-bold uppercase px-4 py-2 text-xs"
            >
              {setupTwoFactorMutation.isPending ? 'Initiating Setup...' : 'Setup 2FA'}
            </Button>
          )}

          {isTwoFactorEnabled && (
            <Button
              variant="outline"
              onClick={() => setIsDisableDialogOpen(true)}
              className="border-zinc-700 hover:bg-zinc-800 text-zinc-200 uppercase text-xs"
            >
              Disable 2FA
            </Button>
          )}
        </div>

        {/* Setup wizard in progress */}
        {setupData && !isTwoFactorEnabled && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-sm p-6 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              Set Up Your Authenticator App
            </h3>

            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="bg-white p-3 rounded-sm border border-zinc-700 inline-block">
                <img
                  src={setupData.qrCodeDataUrl}
                  alt="2FA QR Code"
                  className="w-44 h-44 object-contain"
                />
              </div>

              <div className="space-y-3 flex-1">
                <p className="text-zinc-300">
                  Scan this QR code with your authenticator app (such as Google Authenticator,
                  Authy, 1Password, or Bitwarden).
                </p>
                <div className="space-y-1">
                  <span className="text-zinc-500 uppercase text-[11px] block">
                    Manual Entry Fallback Secret:
                  </span>
                  <code className="block bg-zinc-900 border border-zinc-800 p-2.5 rounded-sm text-zinc-100 font-mono tracking-widest text-xs select-all">
                    {setupData.secret}
                  </code>
                </div>
              </div>
            </div>

            {enableTwoFactorMutation.error?.message && (
              <div className="p-3 bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs">
                [ERROR] {enableTwoFactorMutation.error.message}
              </div>
            )}

            <form onSubmit={handleConfirmEnable} className="space-y-4 max-w-sm pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="enableCode" className="text-zinc-300 uppercase text-xs font-mono">
                  Enter 6-Digit Code to Confirm
                </Label>
                <Input
                  id="enableCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={enableCode}
                  onChange={(e) => setEnableCode(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 tracking-widest text-center text-base font-mono h-10"
                />
              </div>

              <div className="flex space-x-3">
                <Button
                  type="submit"
                  disabled={enableTwoFactorMutation.isPending || enableCode.trim().length !== 6}
                  className="bg-zinc-100 text-zinc-950 hover:bg-zinc-300 font-bold uppercase text-xs h-9 px-4"
                >
                  {enableTwoFactorMutation.isPending ? 'Verifying...' : 'Enable 2FA'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSetupData(null)}
                  className="border-zinc-800 text-zinc-400 hover:text-zinc-100 text-xs h-9 px-4"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Disable confirmation dialog */}
      <Dialog open={isDisableDialogOpen} onOpenChange={setIsDisableDialogOpen}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold uppercase text-white font-mono">
              Disable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 font-mono">
              Please enter a valid 6-digit TOTP code from your authenticator app to disable 2FA.
            </DialogDescription>
          </DialogHeader>

          {disableTwoFactorMutation.error?.message && (
            <div className="p-3 bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs">
              [ERROR] {disableTwoFactorMutation.error.message}
            </div>
          )}

          <form onSubmit={handleConfirmDisable} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="disableCode" className="text-zinc-300 uppercase text-xs">
                Current 6-Digit Code
              </Label>
              <Input
                id="disableCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-zinc-100 tracking-widest text-center text-base font-mono h-10"
                autoFocus
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDisableDialogOpen(false);
                  setDisableCode('');
                }}
                className="border-zinc-800 text-zinc-400 hover:text-zinc-100 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={disableTwoFactorMutation.isPending || disableCode.trim().length !== 6}
                className="bg-zinc-100 text-zinc-950 hover:bg-zinc-300 font-bold uppercase text-xs"
              >
                {disableTwoFactorMutation.isPending ? 'Disabling...' : 'Confirm Disable'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
