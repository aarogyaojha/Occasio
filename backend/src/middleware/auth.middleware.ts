import { Request, Response, NextFunction } from 'express';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { httpStatus, errorCodes, errorMessages } from '../constants';

interface JwtPayload {
  userId: number;
}

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      errorMessages[errorCodes.AUTH_TOKEN_INVALID],
      errorCodes.AUTH_TOKEN_INVALID
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    if (!decoded || typeof decoded.userId !== 'number') {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.AUTH_TOKEN_INVALID],
        errorCodes.AUTH_TOKEN_INVALID
      );
    }
    req.user = { id: decoded.userId };
    next();
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    if (err instanceof TokenExpiredError) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        errorMessages[errorCodes.AUTH_TOKEN_EXPIRED],
        errorCodes.AUTH_TOKEN_EXPIRED
      );
    }
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      errorMessages[errorCodes.AUTH_TOKEN_INVALID],
      errorCodes.AUTH_TOKEN_INVALID
    );
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    if (decoded && typeof decoded.userId === 'number') {
      req.user = { id: decoded.userId };
    }
  } catch {
    // If token verification fails in optional auth, proceed without setting req.user
  }

  next();
};

