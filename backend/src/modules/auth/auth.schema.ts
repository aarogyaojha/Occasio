import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const verifyEmailQuerySchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});

export const enableTwoFactorSchema = z.object({
  code: z.string().trim().length(6, 'Verification code must be 6 digits'),
});

export const disableTwoFactorSchema = z.object({
  code: z.string().trim().length(6, 'Verification code must be 6 digits'),
});

export const verifyTwoFactorLoginSchema = z.object({
  challengeToken: z.string().trim().min(1, 'Challenge token is required'),
  code: z.string().trim().length(6, 'Verification code must be 6 digits'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailQueryInput = z.infer<typeof verifyEmailQuerySchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type EnableTwoFactorInput = z.infer<typeof enableTwoFactorSchema>;
export type DisableTwoFactorInput = z.infer<typeof disableTwoFactorSchema>;
export type VerifyTwoFactorLoginInput = z.infer<typeof verifyTwoFactorLoginSchema>;

