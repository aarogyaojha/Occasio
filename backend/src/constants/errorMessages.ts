import { errorCodes, ErrorCode } from './errorCodes';

export const errorMessages: Record<ErrorCode, string> = {
  [errorCodes.VALIDATION_ERROR]: 'Validation error',
  [errorCodes.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
  [errorCodes.AUTH_TOKEN_EXPIRED]: 'Authentication token has expired',
  [errorCodes.AUTH_TOKEN_INVALID]: 'Invalid or missing authentication token',
  [errorCodes.AUTH_EMAIL_TAKEN]: 'Email is already registered',
  [errorCodes.FORBIDDEN_NOT_OWNER]: 'You do not have permission to access or modify this resource',
  [errorCodes.NOT_FOUND]: 'Resource not found',
  [errorCodes.INTERNAL_ERROR]: 'Internal server error',
};
