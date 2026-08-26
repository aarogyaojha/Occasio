import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventsService } from '../../src/modules/events/events.service';
import { eventsRepository, Event, EventFilters, PaginatedEvents } from '../../src/modules/events/events.repository';
import { AppError } from '../../src/utils/AppError';
import { httpStatus, errorCodes } from '../../src/constants';

vi.mock('../../src/modules/events/events.repository', () => ({
  eventsRepository: {
    create: vi.fn(),
    setEventTags: vi.fn(),
    getTagsForEvent: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Events Service (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEvent: Event = {
    id: 10,
    title: 'Tech Conference 2026',
    description: 'Annual dev conference',
    date: new Date('2026-09-01T10:00:00Z'),
    location: 'Tech Hall',
    capacity: 100,
    is_private: false,
    creator_id: 1,
    created_at: new Date('2026-08-01'),
    updated_at: new Date('2026-08-01'),
  };

  describe('createEvent', () => {
    it('creates an event without tags when tags are not provided', async () => {
      const { tags, ...eventFields } = {
        title: 'Tech Conference 2026',
        description: 'Annual dev conference',
        date: new Date('2026-09-01T10:00:00Z'),
        location: 'Tech Hall',
        capacity: 100,
        is_private: false,
      };

      vi.mocked(eventsRepository.create).mockResolvedValue(mockEvent);

      const result = await eventsService.createEvent(1, eventFields);

      expect(eventsRepository.create).toHaveBeenCalledWith({
        ...eventFields,
        creator_id: 1,
      });
      expect(eventsRepository.setEventTags).not.toHaveBeenCalled();
      expect(eventsRepository.getTagsForEvent).not.toHaveBeenCalled();
      expect(result).toEqual({
        ...mockEvent,
        tags: [],
      });
    });

    it('creates an event and sets tags when tags are provided', async () => {
      const input = {
        title: 'Tech Conference 2026',
        description: 'Annual dev conference',
        date: new Date('2026-09-01T10:00:00Z'),
        location: 'Tech Hall',
        capacity: 100,
        is_private: false,
        tags: [1, 2],
      };

      const mockTags = [
        { id: 1, name: 'Tech', created_at: new Date() },
        { id: 2, name: 'AI', created_at: new Date() },
      ];

      vi.mocked(eventsRepository.create).mockResolvedValue(mockEvent);
      vi.mocked(eventsRepository.setEventTags).mockResolvedValue();
      vi.mocked(eventsRepository.getTagsForEvent).mockResolvedValue(mockTags);

      const result = await eventsService.createEvent(1, input);

      expect(eventsRepository.create).toHaveBeenCalledWith({
        title: input.title,
        description: input.description,
        date: input.date,
        location: input.location,
        capacity: input.capacity,
        is_private: input.is_private,
        creator_id: 1,
      });
      expect(eventsRepository.setEventTags).toHaveBeenCalledWith(10, [1, 2]);
      expect(eventsRepository.getTagsForEvent).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        ...mockEvent,
        tags: mockTags,
      });
    });
  });

  describe('getEventById', () => {
    it('returns the event when found and visible', async () => {
      vi.mocked(eventsRepository.findById).mockResolvedValue(mockEvent);

      const result = await eventsService.getEventById(10, 1);

      expect(eventsRepository.findById).toHaveBeenCalledWith(10, 1);
      expect(result).toEqual(mockEvent);
    });

    it('throws EVENT_NOT_FOUND (404) for a non-existent event', async () => {
      vi.mocked(eventsRepository.findById).mockResolvedValue(null);

      await expect(eventsService.getEventById(999, 1)).rejects.toThrowError(AppError);
      try {
        await eventsService.getEventById(999, 1);
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.NOT_FOUND);
        expect(err.code).toBe(errorCodes.EVENT_NOT_FOUND);
      }
    });

    it('throws EVENT_NOT_FOUND (404) for a private event hidden from the requesting user', async () => {
      // Repository returns null when a private event is not visible to currentUserId
      vi.mocked(eventsRepository.findById).mockResolvedValue(null);

      await expect(eventsService.getEventById(10, 2)).rejects.toThrowError(AppError);
      try {
        await eventsService.getEventById(10, 2);
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.NOT_FOUND);
        expect(err.code).toBe(errorCodes.EVENT_NOT_FOUND);
      }
    });
  });

  describe('listEvents', () => {
    it('passes filter parameters through to the repository unchanged', async () => {
      const filters: EventFilters = {
        search: 'Tech',
        tagId: 1,
        page: 2,
        limit: 10,
        sortBy: 'date',
        sortOrder: 'asc',
        currentUserId: 5,
      };

      const paginatedResult: PaginatedEvents = {
        events: [mockEvent],
        meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
      };

      vi.mocked(eventsRepository.findAll).mockResolvedValue(paginatedResult);

      const result = await eventsService.listEvents(filters);

      expect(eventsRepository.findAll).toHaveBeenCalledWith(filters);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('updateEvent', () => {
    it('throws EVENT_NOT_FOUND (404) if event is missing', async () => {
      vi.mocked(eventsRepository.findById).mockResolvedValue(null);

      await expect(eventsService.updateEvent(1, 999, { title: 'New' })).rejects.toThrowError(
        AppError
      );
      try {
        await eventsService.updateEvent(1, 999, { title: 'New' });
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.NOT_FOUND);
        expect(err.code).toBe(errorCodes.EVENT_NOT_FOUND);
      }
    });

    it('throws FORBIDDEN_NOT_OWNER (403) when requesting user is not the creator', async () => {
      const nonOwnedEvent: Event = { ...mockEvent, creator_id: 1 };
      vi.mocked(eventsRepository.findById).mockResolvedValue(nonOwnedEvent);

      await expect(eventsService.updateEvent(2, 10, { title: 'Hacked Title' })).rejects.toThrowError(
        AppError
      );
      try {
        await eventsService.updateEvent(2, 10, { title: 'Hacked Title' });
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.FORBIDDEN);
        expect(err.code).toBe(errorCodes.FORBIDDEN_NOT_OWNER);
      }
    });

    it('updates event fields and tags when requester is the owner', async () => {
      const ownedEvent: Event = { ...mockEvent, creator_id: 1 };
      const updatedEventRecord: Event = { ...mockEvent, title: 'Updated Title' };

      vi.mocked(eventsRepository.findById)
        .mockResolvedValueOnce(ownedEvent) // First call to check ownership
        .mockResolvedValueOnce(updatedEventRecord); // Second call to retrieve updated record

      vi.mocked(eventsRepository.update).mockResolvedValue();
      vi.mocked(eventsRepository.setEventTags).mockResolvedValue();

      const result = await eventsService.updateEvent(1, 10, { title: 'Updated Title', tags: [3] });

      expect(eventsRepository.update).toHaveBeenCalledWith(10, { title: 'Updated Title' });
      expect(eventsRepository.setEventTags).toHaveBeenCalledWith(10, [3]);
      expect(result).toEqual(updatedEventRecord);
    });
  });

  describe('deleteEvent', () => {
    it('throws EVENT_NOT_FOUND (404) if event is missing', async () => {
      vi.mocked(eventsRepository.findById).mockResolvedValue(null);

      await expect(eventsService.deleteEvent(1, 999)).rejects.toThrowError(AppError);
      try {
        await eventsService.deleteEvent(1, 999);
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.NOT_FOUND);
        expect(err.code).toBe(errorCodes.EVENT_NOT_FOUND);
      }
    });

    it('throws FORBIDDEN_NOT_OWNER (403) when requesting user is not creator', async () => {
      const nonOwnedEvent: Event = { ...mockEvent, creator_id: 1 };
      vi.mocked(eventsRepository.findById).mockResolvedValue(nonOwnedEvent);

      await expect(eventsService.deleteEvent(2, 10)).rejects.toThrowError(AppError);
      try {
        await eventsService.deleteEvent(2, 10);
      } catch (err: any) {
        expect(err.statusCode).toBe(httpStatus.FORBIDDEN);
        expect(err.code).toBe(errorCodes.FORBIDDEN_NOT_OWNER);
      }
    });

    it('deletes event when user is creator', async () => {
      const ownedEvent: Event = { ...mockEvent, creator_id: 1 };
      vi.mocked(eventsRepository.findById).mockResolvedValue(ownedEvent);
      vi.mocked(eventsRepository.delete).mockResolvedValue();

      await eventsService.deleteEvent(1, 10);

      expect(eventsRepository.delete).toHaveBeenCalledWith(10);
    });
  });
});
