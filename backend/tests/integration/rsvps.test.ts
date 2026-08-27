import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import db from '../../src/db/knex';
import { resetRateLimiters } from '../../src/middleware/rateLimiter.middleware';
import { httpStatus, errorCodes } from '../../src/constants';

vi.mock('../../src/utils/sendVerificationEmail', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/config/mailer', () => ({
  transporter: {
    sendMail: vi.fn().mockResolvedValue({}),
  },
}));

describe('RSVPs Module Integration Tests', () => {
  let user1Token: string;
  let user1Id: number;
  let user2Token: string;
  let user2Id: number;
  let publicEventId: number;
  let privateEventId: number;

  async function createVerifiedUser(name: string, email: string, password = 'password123') {
    const existing = await db('users').where({ email }).first();
    if (existing) {
      await db('event_rsvps').where({ user_id: existing.id }).del();
      const userEvents = await db('events').where({ creator_id: existing.id }).select('id');
      const eventIds = userEvents.map((e) => e.id);
      if (eventIds.length > 0) {
        await db('event_rsvps').whereIn('event_id', eventIds).del();
        await db('event_tags').whereIn('event_id', eventIds).del();
        await db('events').whereIn('id', eventIds).del();
      }
      await db('email_verification_tokens').where({ user_id: existing.id }).del();
      await db('refresh_tokens').where({ user_id: existing.id }).del();
      await db('users').where({ id: existing.id }).del();
    }
    const signupRes = await request(app)
      .post('/auth/signup')
      .send({ name, email, password });
    const userId = signupRes.body.data.user.id;
    await db('users').where({ id: userId }).update({ email_verified: true });
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email, password });
    return { id: userId, token: loginRes.body.data.accessToken as string };
  }

  beforeEach(async () => {
    resetRateLimiters();
    await db('event_rsvps').del();
    await db('event_tags').del();
    await db('tags').del();
    await db('events').del();
    await db('email_verification_tokens').del();
    await db('refresh_tokens').del();
    await db('users').del();

    // Register User 1 (Creator)
    const user1 = await createVerifiedUser('Alice Creator', 'alice@example.com');
    user1Id = user1.id;
    user1Token = user1.token;

    // Register User 2 (Participant)
    const user2 = await createVerifiedUser('Bob Participant', 'bob@example.com');
    user2Id = user2.id;
    user2Token = user2.token;

    // Create a public event owned by User 1
    const publicEventRes = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Public Tech Workshop',
        description: 'Open to everyone',
        start_datetime: '2026-09-01T10:00:00.000Z',
        location: 'Hall A',
        event_type: 'public',
      });
    publicEventId = publicEventRes.body.data.event.id;

    // Create a private event owned by User 1
    const privateEventRes = await request(app)
      .post('/events')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Private Party',
        description: 'Secret gathering',
        start_datetime: '2026-09-02T18:00:00.000Z',
        location: 'VIP Lounge',
        event_type: 'private',
      });
    privateEventId = privateEventRes.body.data.event.id;
  });

  afterAll(async () => {
    await db('event_rsvps').del();
    await db('event_tags').del();
    await db('tags').del();
    await db('events').del();
    await db('refresh_tokens').del();
    await db('users').del();
    await db.destroy();
  });

  describe('POST /events/:eventId/rsvp', () => {
    it('returns 401 Unauthorized when attempting to RSVP without auth token', async () => {
      const response = await request(app)
        .post(`/events/${publicEventId}/rsvp`)
        .send({ status: 'yes' });

      expect(response.status).toBe(httpStatus.UNAUTHORIZED);
      expect(response.body.error.code).toBe(errorCodes.AUTH_TOKEN_INVALID);
    });

    it('returns 404 EVENT_NOT_FOUND when attempting to RSVP to someone else\'s private event', async () => {
      const response = await request(app)
        .post(`/events/${privateEventId}/rsvp`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ status: 'yes' });

      expect(response.status).toBe(httpStatus.NOT_FOUND);
      expect(response.body.error.code).toBe(errorCodes.EVENT_NOT_FOUND);
    });

    it('successfully submits RSVP as yes, no, and maybe', async () => {
      // User 2 RSVPs 'yes' to public event
      const res1 = await request(app)
        .post(`/events/${publicEventId}/rsvp`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ status: 'yes' });

      expect(res1.status).toBe(httpStatus.OK);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.userStatus).toBe('yes');
      expect(res1.body.data.counts).toEqual({ yes: 1, no: 0, maybe: 0 });

      // User 1 RSVPs 'maybe' to same event
      const res2 = await request(app)
        .post(`/events/${publicEventId}/rsvp`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ status: 'maybe' });

      expect(res2.status).toBe(httpStatus.OK);
      expect(res2.body.data.userStatus).toBe('maybe');
      expect(res2.body.data.counts).toEqual({ yes: 1, no: 0, maybe: 1 });
    });

    it('updates RSVP in place when user changes their response (does not duplicate count)', async () => {
      // User 2 RSVPs 'yes'
      await request(app)
        .post(`/events/${publicEventId}/rsvp`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ status: 'yes' });

      // User 2 changes RSVP to 'no'
      const changeRes = await request(app)
        .post(`/events/${publicEventId}/rsvp`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ status: 'no' });

      expect(changeRes.status).toBe(httpStatus.OK);
      expect(changeRes.body.data.userStatus).toBe('no');
      expect(changeRes.body.data.counts).toEqual({ yes: 0, no: 1, maybe: 0 });

      // Verify DB table record count is exactly 1 for user 2 on publicEventId
      const rows = await db('event_rsvps').where({
        event_id: publicEventId,
        user_id: user2Id,
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('no');
    });
  });

  describe('RSVP Data integration on Event Endpoints', () => {
    beforeEach(async () => {
      // User 2 RSVPs 'yes' to public event
      await request(app)
        .post(`/events/${publicEventId}/rsvp`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ status: 'yes' });
    });

    it('GET /events/:id returns rsvp_counts and current_user_rsvp', async () => {
      // Authenticated user (User 2)
      const authRes = await request(app)
        .get(`/events/${publicEventId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(authRes.status).toBe(httpStatus.OK);
      expect(authRes.body.data.event.rsvp_counts).toEqual({ yes: 1, no: 0, maybe: 0 });
      expect(authRes.body.data.event.current_user_rsvp).toBe('yes');

      // Unauthenticated user
      const unauthRes = await request(app).get(`/events/${publicEventId}`);
      expect(unauthRes.status).toBe(httpStatus.OK);
      expect(unauthRes.body.data.event.rsvp_counts).toEqual({ yes: 1, no: 0, maybe: 0 });
      expect(unauthRes.body.data.event.current_user_rsvp).toBeNull();
    });

    it('GET /events (list) returns rsvp_counts and current_user_rsvp for all returned items', async () => {
      // Authenticated user (User 2)
      const listRes = await request(app)
        .get('/events')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(listRes.status).toBe(httpStatus.OK);
      expect(listRes.body.data).toBeInstanceOf(Array);

      const targetEvent = listRes.body.data.find((e: any) => e.id === publicEventId);
      expect(targetEvent).toBeDefined();
      expect(targetEvent.rsvp_counts).toEqual({ yes: 1, no: 0, maybe: 0 });
      expect(targetEvent.current_user_rsvp).toBe('yes');
    });
  });
});
