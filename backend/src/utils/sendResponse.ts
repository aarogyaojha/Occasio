import { Response } from 'express';
import { HttpStatus } from '../constants';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface ApiResponse<T, M = PaginationMeta> {
  success: true;
  data: T;
  meta?: M;
}

/**
 * Sends a standardized JSON success response envelope.
 *
 * @param res - Express response object.
 * @param statusCode - HTTP status code (from httpStatus constants).
 * @param data - Payload data to include in the response.
 * @param meta - Optional metadata (e.g. pagination info). Omitted if not provided.
 */
export function sendResponse<T, M = PaginationMeta>(
  res: Response,
  statusCode: HttpStatus | number,
  data: T,
  meta?: M
): void {
  const responseBody: ApiResponse<T, M> = {
    success: true,
    data,
    ...(meta !== undefined ? { meta } : {}),
  };

  res.status(statusCode).json(responseBody);
}
