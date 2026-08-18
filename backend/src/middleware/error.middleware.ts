import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { httpStatus, errorCodes, errorMessages } from '../constants';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && err.details !== null ? { details: err.details } : {}),
      },
    });
    return;
  }

  console.error('Unhandled Error:', err);
  res.status(httpStatus.INTERNAL_ERROR).json({
    error: {
      code: errorCodes.INTERNAL_ERROR,
      message: errorMessages[errorCodes.INTERNAL_ERROR],
    },
  });
};
