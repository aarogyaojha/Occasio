import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';
import { httpStatus, errorCodes, errorMessages } from '../constants';

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const message =
        result.error.issues.map((issue) => issue.message).join(', ') ||
        errorMessages[errorCodes.VALIDATION_ERROR];
      throw new AppError(
        httpStatus.BAD_REQUEST,
        message,
        errorCodes.VALIDATION_ERROR,
        fieldErrors
      );
    }
    req.body = result.data;
    next();
  };
};
