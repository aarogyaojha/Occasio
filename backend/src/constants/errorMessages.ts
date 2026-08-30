import { errorCodes, ErrorCode } from './errorCodes';

export const errorMessages: Record<ErrorCode, string> = {
  [errorCodes.VALIDATION_ERROR]: 'Validation error',
  [errorCodes.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
  [errorCodes.AUTH_TOKEN_EXPIRED]: 'Authentication token has expired',
  [errorCodes.AUTH_TOKEN_INVALID]: 'Invalid or missing authentication token',
  [errorCodes.AUTH_EMAIL_TAKEN]: 'Email is already registered',
  [errorCodes.EVENT_NOT_FOUND]: 'Event not found',
  [errorCodes.TAG_NOT_FOUND]: 'Tag not found',
  [errorCodes.FORBIDDEN_NOT_OWNER]: 'You do not have permission to access or modify this resource',
  [errorCodes.NOT_FOUND]: 'Resource not found',
  [errorCodes.INTERNAL_ERROR]: 'Internal server error',
  [errorCodes.RATE_LIMITED]: 'Too many requests, please try again later',
  [errorCodes.EMAIL_NOT_VERIFIED]: 'Please verify your email before logging in',
  [errorCodes.EMAIL_VERIFICATION_INVALID]: 'Invalid, expired, or already used email verification token',
  [errorCodes.MFA_CODE_INVALID]: 'Invalid verification code',
  [errorCodes.MFA_CHALLENGE_INVALID]: 'Invalid or expired MFA challenge',
};
