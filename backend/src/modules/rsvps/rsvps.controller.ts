import { Request, Response } from 'express';
import { rsvpsService } from './rsvps.service';
import { sendResponse } from '../../utils/sendResponse';
import { httpStatus } from '../../constants';

export const rsvpsController = {
  /**
   * Submits or updates an RSVP for an event.
   *
   * @param req - Express request object with eventId in params, status in body, and authenticated user.
   * @param res - Express response object.
   */
  async setRsvp(req: Request, res: Response): Promise<void> {
    const eventId = Number(req.params.eventId);
    const userId = req.user!.id;
    const { status } = req.body;

    const result = await rsvpsService.setRsvp(eventId, userId, status);
    sendResponse(res, httpStatus.OK, result);
  },
};
