import { eventsRepository, Event } from './events.repository';
import { CreateEventInput, UpdateEventInput } from './events.schema';
import { AppError } from '../../utils/AppError';
import { httpStatus, errorCodes, errorMessages } from '../../constants';

export const eventsService = {
  /**
   * Creates a new event for the authenticated user.
   *
   * @param userId - The ID of the authenticated user creating the event.
   * @param data - The event details to create.
   * @returns The created event record.
   */
  async createEvent(userId: number, data: CreateEventInput): Promise<Event> {
    return eventsRepository.create({
      ...data,
      creator_id: userId,
    });
  },

  /**
   * Retrieves a single event by its unique ID, respecting visibility rules.
   *
   * @param id - The ID of the event to retrieve.
   * @param currentUserId - Optional ID of the currently authenticated user.
   * @returns The event record if found and visible.
   * @throws AppError 404 if the event does not exist or is private and not owned by requester.
   */
  async getEventById(id: number, currentUserId?: number): Promise<Event> {
    const event = await eventsRepository.findById(id, currentUserId);
    if (!event) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        errorMessages[errorCodes.EVENT_NOT_FOUND],
        errorCodes.EVENT_NOT_FOUND
      );
    }
    return event;
  },

  /**
   * Lists all visible events ordered by start datetime.
   *
   * @param currentUserId - Optional ID of the currently authenticated user.
   * @returns An array of all visible event records.
   */
  async listEvents(currentUserId?: number): Promise<Event[]> {
    return eventsRepository.findAll(currentUserId);
  },

  /**
   * Updates an existing event after verifying that the requesting user is the creator.
   *
   * @param userId - The ID of the authenticated user attempting the update.
   * @param eventId - The ID of the event to update.
   * @param data - The partial event data to update.
   * @returns The updated event record.
   * @throws AppError 404 if the event does not exist or is not accessible.
   * @throws AppError 403 if the user is not the owner/creator of the event.
   */
  async updateEvent(userId: number, eventId: number, data: UpdateEventInput): Promise<Event> {
    const event = await eventsRepository.findById(eventId, userId);
    if (!event) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        errorMessages[errorCodes.EVENT_NOT_FOUND],
        errorCodes.EVENT_NOT_FOUND
      );
    }

    if (event.creator_id !== userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        errorMessages[errorCodes.FORBIDDEN_NOT_OWNER],
        errorCodes.FORBIDDEN_NOT_OWNER
      );
    }

    const updatedEvent = await eventsRepository.update(eventId, data);
    return updatedEvent!;
  },

  /**
   * Deletes an event after verifying that the requesting user is the creator.
   *
   * @param userId - The ID of the authenticated user attempting deletion.
   * @param eventId - The ID of the event to delete.
   * @throws AppError 404 if the event does not exist or is not accessible.
   * @throws AppError 403 if the user is not the owner/creator of the event.
   */
  async deleteEvent(userId: number, eventId: number): Promise<void> {
    const event = await eventsRepository.findById(eventId, userId);
    if (!event) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        errorMessages[errorCodes.EVENT_NOT_FOUND],
        errorCodes.EVENT_NOT_FOUND
      );
    }

    if (event.creator_id !== userId) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        errorMessages[errorCodes.FORBIDDEN_NOT_OWNER],
        errorCodes.FORBIDDEN_NOT_OWNER
      );
    }

    await eventsRepository.delete(eventId);
  },
};
