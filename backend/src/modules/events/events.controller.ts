import { Request, Response } from 'express';
import { eventsService } from './events.service';
import { sendResponse } from '../../utils/sendResponse';
import { httpStatus, messages } from '../../constants';

export const eventsController = {
  async create(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const event = await eventsService.createEvent(userId, req.body);
    sendResponse(res, httpStatus.CREATED, { event });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const currentUserId = req.user?.id;
    const event = await eventsService.getEventById(id, currentUserId);
    sendResponse(res, httpStatus.OK, { event });
  },

  async list(req: Request, res: Response): Promise<void> {
    const currentUserId = req.user?.id;
    const events = await eventsService.listEvents(currentUserId);
    sendResponse(res, httpStatus.OK, { events });
  },

  async update(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    const event = await eventsService.updateEvent(userId, id, req.body);
    sendResponse(res, httpStatus.OK, { event });
  },

  async delete(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    await eventsService.deleteEvent(userId, id);
    sendResponse(res, httpStatus.OK, {
      message: messages.EVENT_DELETED,
    });
  },
};
