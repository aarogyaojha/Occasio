import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { httpStatus, errorCodes, errorMessages } from '../constants';
import { isProduction } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : httpStatus.INTERNAL_ERROR;
  const code = err instanceof AppError ? err.code : errorCodes.INTERNAL_ERROR;
  const message = err.message || errorMessages[errorCodes.INTERNAL_ERROR];

  if (statusCode >= 500) {
    const errorLog: Record<string, unknown> = {
      code,
      message,
      status: statusCode,
      method: req.method,
      path: req.originalUrl || req.path,
    };

    if (!isProduction && err.stack) {
      errorLog.stack = err.stack;
    }

    console.error('[Error]', errorLog);
  } else {
    console.warn('[Error]', {
      status: statusCode,
      code,
      method: req.method,
      path: req.originalUrl || req.path,
    });
  }

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

  res.status(httpStatus.INTERNAL_ERROR).json({
    error: {
      code: errorCodes.INTERNAL_ERROR,
      message: errorMessages[errorCodes.INTERNAL_ERROR],
    },
  });
};
