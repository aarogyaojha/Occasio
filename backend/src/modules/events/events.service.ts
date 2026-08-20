import { eventsRepository, Event, EventFilters, PaginatedEvents } from './events.repository';
import { CreateEventInput, UpdateEventInput } from './events.schema';
import { AppError } from '../../utils/AppError';
import { httpStatus, errorCodes, errorMessages } from '../../constants';

export const eventsService = {
  /**
   * Creates a new event and assigns any provided tags for the authenticated user.
   *
   * @param userId - The ID of the authenticated user creating the event.
   * @param data - The event details and optional tags to create.
   * @returns The created event record with tags.
   */
  async createEvent(userId: number, data: CreateEventInput): Promise<Event> {
    const { tags, ...eventFields } = data;
    const event = await eventsRepository.create({
      ...eventFields,
      creator_id: userId,
    });

    if (tags !== undefined) {
      await eventsRepository.setEventTags(event.id, tags);
    }

    const eventTags = tags !== undefined ? await eventsRepository.getTagsForEvent(event.id) : [];
    return {
      ...event,
      tags: eventTags,
    };
  },

  /**
   * Retrieves a single event by its unique ID with associated tags, respecting visibility rules.
   *
   * @param id - The ID of the event to retrieve.
   * @param currentUserId - Optional ID of the currently authenticated user.
   * @returns The event record with tags if found and visible.
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
   * Lists visible events with filtering, search, sorting, and pagination.
   *
   * @param filters - Filter, search, sort, and pagination criteria.
   * @returns Paginated result containing events array and pagination metadata.
   */
  async listEvents(filters: EventFilters = {}): Promise<PaginatedEvents> {
    return eventsRepository.findAll(filters);
  },

  /**
   * Updates an existing event and its tags after verifying that the requesting user is the creator.
   *
   * @param userId - The ID of the authenticated user attempting the update.
   * @param eventId - The ID of the event to update.
   * @param data - The partial event data and optional tags to update.
   * @returns The updated event record with tags.
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

    const { tags, ...eventFields } = data;
    if (Object.keys(eventFields).length > 0) {
      await eventsRepository.update(eventId, eventFields);
    }

    if (tags !== undefined) {
      await eventsRepository.setEventTags(eventId, tags);
    }

    const updatedEvent = await eventsRepository.findById(eventId, userId);
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
