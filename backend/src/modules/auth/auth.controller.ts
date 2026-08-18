import { Request, Response, CookieOptions } from 'express';
import { authService } from './auth.service';
import { isProduction } from '../../config/env';
import { sendResponse } from '../../utils/sendResponse';
import {
  httpStatus,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRY_DAYS,
  messages,
} from '../../constants';

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/',
  maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
};

export const authController = {
  async signup(req: Request, res: Response): Promise<void> {
    const result = await authService.signup(req.body);
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    sendResponse(res, httpStatus.CREATED, {
      user: result.user,
      accessToken: result.accessToken,
    });
  },

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body);
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    sendResponse(res, httpStatus.OK, {
      user: result.user,
      accessToken: result.accessToken,
    });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;
    const result = await authService.refresh(rawRefreshToken);
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTIONS);
    sendResponse(res, httpStatus.OK, {
      accessToken: result.accessToken,
    });
  },

  async logout(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;
    await authService.logout(rawRefreshToken);
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
    sendResponse(res, httpStatus.OK, {
      message: messages.LOGOUT_SUCCESS,
    });
  },
};
