export const ACCESS_TOKEN_EXPIRY = '15m';
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

export const authConstants = {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
  REFRESH_TOKEN_COOKIE_NAME,
} as const;
