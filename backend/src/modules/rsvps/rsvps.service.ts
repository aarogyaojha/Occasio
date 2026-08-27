import { rsvpsRepository, RsvpCounts } from './rsvps.repository';
import { eventsService } from '../events/events.service';
import { RsvpStatus } from '../../constants';

export interface SetRsvpResult {
  counts: RsvpCounts;
  userStatus: RsvpStatus;
}

export const rsvpsService = {
  /**
   * Sets or updates an RSVP for an event after verifying event existence and visibility.
   *
   * @param eventId - The ID of the event to RSVP to.
   * @param userId - The ID of the authenticated user submitting the RSVP.
   * @param status - The selected RSVP status ('yes', 'no', 'maybe').
   * @returns Object containing the updated aggregated counts and the user's updated RSVP status.
   * @throws AppError (404 EVENT_NOT_FOUND) if event does not exist or is a private event invisible to the user.
   */
  async setRsvp(eventId: number, userId: number, status: RsvpStatus): Promise<SetRsvpResult> {
    // 1. Verify event exists and is visible to the requesting user
    await eventsService.getEventById(eventId, userId);

    // 2. Perform upsert operation
    await rsvpsRepository.upsert(eventId, userId, status);

    // 3. Fetch updated counts and current user's status
    const counts = await rsvpsRepository.getCounts(eventId);
    const userStatus = await rsvpsRepository.getUserRsvp(eventId, userId);

    return {
      counts,
      userStatus: userStatus!,
    };
  },
};
