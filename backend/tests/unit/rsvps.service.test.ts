import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rsvpsService } from '../../src/modules/rsvps/rsvps.service';
import { rsvpsRepository, RsvpCounts } from '../../src/modules/rsvps/rsvps.repository';
import { eventsService } from '../../src/modules/events/events.service';
import { AppError } from '../../src/utils/AppError';
import { httpStatus, errorCodes } from '../../src/constants';

vi.mock('../../src/modules/rsvps/rsvps.repository', () => ({
  rsvpsRepository: {
    upsert: vi.fn(),
    getCounts: vi.fn(),
    getUserRsvp: vi.fn(),
  },
}));

vi.mock('../../src/modules/events/events.service', () => ({
  eventsService: {
    getEventById: vi.fn(),
  },
}));

describe('RSVPs Service (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockEvent = {
    id: 10,
    title: 'Tech Meetup',
    description: 'Tech event',
    start_datetime: new Date(),
    location: 'Building A',
    event_type: 'public' as const,
    creator_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  describe('setRsvp', () => {
    it('throws EVENT_NOT_FOUND (404) for a private event hidden from the user', async () => {
      vi.mocked(eventsService.getEventById).mockRejectedValue(
        new AppError(
          httpStatus.NOT_FOUND,
          'Event not found',
          errorCodes.EVENT_NOT_FOUND
        )
      );

      await expect(rsvpsService.setRsvp(10, 2, 'yes')).rejects.toThrowError(AppError);
      expect(eventsService.getEventById).toHaveBeenCalledWith(10, 2);
      expect(rsvpsRepository.upsert).not.toHaveBeenCalled();
    });

    it('calls upsert correctly and returns updated counts and user status', async () => {
      const mockCounts: RsvpCounts = { yes: 1, no: 0, maybe: 0 };

      vi.mocked(eventsService.getEventById).mockResolvedValue(mockEvent as any);
      vi.mocked(rsvpsRepository.upsert).mockResolvedValue();
      vi.mocked(rsvpsRepository.getCounts).mockResolvedValue(mockCounts);
      vi.mocked(rsvpsRepository.getUserRsvp).mockResolvedValue('yes');

      const result = await rsvpsService.setRsvp(10, 1, 'yes');

      expect(eventsService.getEventById).toHaveBeenCalledWith(10, 1);
      expect(rsvpsRepository.upsert).toHaveBeenCalledWith(10, 1, 'yes');
      expect(rsvpsRepository.getCounts).toHaveBeenCalledWith(10);
      expect(rsvpsRepository.getUserRsvp).toHaveBeenCalledWith(10, 1);
      expect(result).toEqual({
        counts: mockCounts,
        userStatus: 'yes',
      });
    });

    it('handles repeat RSVP updates correctly (changing status from yes to maybe)', async () => {
      const updatedCounts: RsvpCounts = { yes: 0, no: 0, maybe: 1 };

      vi.mocked(eventsService.getEventById).mockResolvedValue(mockEvent as any);
      vi.mocked(rsvpsRepository.upsert).mockResolvedValue();
      vi.mocked(rsvpsRepository.getCounts).mockResolvedValue(updatedCounts);
      vi.mocked(rsvpsRepository.getUserRsvp).mockResolvedValue('maybe');

      const result = await rsvpsService.setRsvp(10, 1, 'maybe');

      expect(eventsService.getEventById).toHaveBeenCalledWith(10, 1);
      expect(rsvpsRepository.upsert).toHaveBeenCalledWith(10, 1, 'maybe');
      expect(result).toEqual({
        counts: updatedCounts,
        userStatus: 'maybe',
      });
    });
  });
});
