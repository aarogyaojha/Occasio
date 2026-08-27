import type { Knex } from 'knex';
import db from '../../db/knex';
import { RsvpStatus } from '../../constants';

export interface RsvpCounts {
  yes: number;
  no: number;
  maybe: number;
}

export interface EventRsvp {
  id: number;
  event_id: number;
  user_id: number;
  status: RsvpStatus;
  created_at: Date;
  updated_at: Date;
}

export const rsvpsRepository = {
  /**
   * Upserts an RSVP status for a given event and user.
   * Updates in place if an RSVP record already exists for the (event_id, user_id) unique constraint.
   *
   * @param eventId - The unique event ID.
   * @param userId - The ID of the user RSVPing.
   * @param status - The selected RSVP status ('yes', 'no', 'maybe').
   * @param trx - Optional Knex transaction object.
   */
  async upsert(
    eventId: number,
    userId: number,
    status: RsvpStatus,
    trx?: Knex.Transaction
  ): Promise<void> {
    const knexInstance = trx || db;
    await knexInstance('event_rsvps')
      .insert({
        event_id: eventId,
        user_id: userId,
        status,
      })
      .onConflict(['event_id', 'user_id'])
      .merge({
        status,
        updated_at: knexInstance.fn.now(),
      });
  },

  /**
   * Retrieves grouped RSVP counts (yes, no, maybe) for a single event.
   * Executes a single aggregated group query.
   *
   * @param eventId - The unique event ID.
   * @param trx - Optional Knex transaction object.
   * @returns Object containing counts for yes, no, and maybe statuses.
   */
  async getCounts(eventId: number, trx?: Knex.Transaction): Promise<RsvpCounts> {
    const knexInstance = trx || db;
    const rows = await knexInstance('event_rsvps')
      .where({ event_id: eventId })
      .select('status')
      .count('id as count')
      .groupBy('status');

    const counts: RsvpCounts = { yes: 0, no: 0, maybe: 0 };
    for (const row of rows) {
      const status = row.status as RsvpStatus;
      if (status in counts) {
        counts[status] = Number(row.count);
      }
    }
    return counts;
  },

  /**
   * Retrieves the current user's RSVP status for a specific event.
   *
   * @param eventId - The unique event ID.
   * @param userId - The ID of the authenticated user.
   * @param trx - Optional Knex transaction object.
   * @returns The user's RSVP status string or null if not found.
   */
  async getUserRsvp(
    eventId: number,
    userId: number,
    trx?: Knex.Transaction
  ): Promise<RsvpStatus | null> {
    const knexInstance = trx || db;
    const rsvp = await knexInstance('event_rsvps')
      .where({ event_id: eventId, user_id: userId })
      .first();
    return rsvp ? (rsvp.status as RsvpStatus) : null;
  },

  /**
   * Batch loads grouped RSVP counts for multiple event IDs in a single query.
   * Prevents N+1 database query issues during list fetching.
   *
   * @param eventIds - Array of event IDs to batch load counts for.
   * @param trx - Optional Knex transaction object.
   * @returns A Map mapping eventId to its RsvpCounts object.
   */
  async getBatchCounts(
    eventIds: number[],
    trx?: Knex.Transaction
  ): Promise<Map<number, RsvpCounts>> {
    const knexInstance = trx || db;
    const map = new Map<number, RsvpCounts>();
    if (eventIds.length === 0) {
      return map;
    }

    const rows = await knexInstance('event_rsvps')
      .whereIn('event_id', eventIds)
      .select('event_id', 'status')
      .count('id as count')
      .groupBy('event_id', 'status');

    for (const row of rows) {
      const eventId = Number(row.event_id);
      if (!map.has(eventId)) {
        map.set(eventId, { yes: 0, no: 0, maybe: 0 });
      }
      const status = row.status as RsvpStatus;
      const counts = map.get(eventId)!;
      if (status in counts) {
        counts[status] = Number(row.count);
      }
    }
    return map;
  },

  /**
   * Batch loads RSVP status for a specific user across multiple event IDs in a single query.
   * Prevents N+1 query issues when rendering user status in paginated lists.
   *
   * @param eventIds - Array of event IDs to check.
   * @param userId - The ID of the authenticated user.
   * @param trx - Optional Knex transaction object.
   * @returns A Map mapping eventId to the user's RsvpStatus.
   */
  async getBatchUserRsvps(
    eventIds: number[],
    userId: number,
    trx?: Knex.Transaction
  ): Promise<Map<number, RsvpStatus>> {
    const knexInstance = trx || db;
    const map = new Map<number, RsvpStatus>();
    if (eventIds.length === 0) {
      return map;
    }

    const rows = await knexInstance('event_rsvps')
      .whereIn('event_id', eventIds)
      .where({ user_id: userId })
      .select('event_id', 'status');

    for (const row of rows) {
      map.set(Number(row.event_id), row.status as RsvpStatus);
    }
    return map;
  },
};
