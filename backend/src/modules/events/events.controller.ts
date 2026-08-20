import { Request, Response } from 'express';
import { eventsService } from './events.service';
import { listEventsQuerySchema } from './events.schema';
import { sendResponse } from '../../utils/sendResponse';
import { AppError } from '../../utils/AppError';
import { httpStatus, messages, errorCodes, errorMessages } from '../../constants';

export const eventsController = {
  /**
   * Creates a new event.
   *
   * @param req - Express request object containing event body and authenticated user.
   * @param res - Express response object.
   */
  async create(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const event = await eventsService.createEvent(userId, req.body);
    sendResponse(res, httpStatus.CREATED, { event });
  },

  /**
   * Retrieves a single event by ID with tags.
   *
   * @param req - Express request object containing event ID in params.
   * @param res - Express response object.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const currentUserId = req.user?.id;
    const event = await eventsService.getEventById(id, currentUserId);
    sendResponse(res, httpStatus.OK, { event });
  },

  /**
   * Lists events with filtering, search, sorting, and pagination.
   *
   * @param req - Express request object containing query filters.
   * @param res - Express response object.
   */
  async list(req: Request, res: Response): Promise<void> {
    const parseResult = listEventsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const details = parseResult.error.issues.map((issue) => ({
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

    const currentUserId = req.user?.id;
    const { data: events, meta } = await eventsService.listEvents({
      ...parseResult.data,
      currentUserId,
    });
    sendResponse(res, httpStatus.OK, events, meta);
  },

  /**
   * Updates an existing event.
   *
   * @param req - Express request object containing event update fields.
   * @param res - Express response object.
   */
  async update(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    const event = await eventsService.updateEvent(userId, id, req.body);
    sendResponse(res, httpStatus.OK, { event });
  },

  /**
   * Deletes an event.
   *
   * @param req - Express request object containing event ID in params.
   * @param res - Express response object.
   */
  async delete(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    await eventsService.deleteEvent(userId, id);
    sendResponse(res, httpStatus.OK, {
      message: messages.EVENT_DELETED,
    });
  },
};
