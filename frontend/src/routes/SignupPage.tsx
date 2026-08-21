import React from 'react';
import { SignupForm } from '../features/auth/SignupForm';

export const SignupPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6 selection:bg-zinc-100 selection:text-zinc-950">
      <SignupForm />
    </div>
  );
};

export default SignupPage;
