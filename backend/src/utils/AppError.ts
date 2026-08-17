import { HttpStatus, ErrorCode, errorMessages } from '../constants';

export class AppError extends Error {
  public readonly statusCode: HttpStatus | number;
  public readonly code: ErrorCode | string;
  public readonly details?: unknown;

  constructor(
    statusCode: HttpStatus | number,
    message?: string,
    code?: ErrorCode | string,
    details?: unknown
  ) {
    const resolvedCode = code || 'INTERNAL_ERROR';
    const defaultMessage = (resolvedCode in errorMessages ? errorMessages[resolvedCode as ErrorCode] : undefined) || 'An error occurred';
    super(message || defaultMessage);
    this.statusCode = statusCode;
    this.code = resolvedCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
