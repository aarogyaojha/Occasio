import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';
import { httpStatus, errorCodes, errorMessages } from '../constants';

export const validate = (schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const dataToValidate = req[target];
    const result = schema.safeParse(dataToValidate);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError(
        httpStatus.BAD_REQUEST,
        errorMessages[errorCodes.VALIDATION_ERROR],
        errorCodes.VALIDATION_ERROR,
        details
      );
    }
    if (target === 'body') {
      req.body = result.data;
    }
    next();
  };
};
