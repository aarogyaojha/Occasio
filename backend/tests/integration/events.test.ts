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

describe('Events Module Integration Tests', () => {
  let user1Token: string;
  let user1Id: number;
  let user2Token: string;
  let user2Id: number;

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
    // Reset rate limiters and clear tables before each test
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

    // Register User 2 (Other User)
    const user2 = await createVerifiedUser('Bob Other', 'bob@example.com');
    user2Id = user2.id;
    user2Token = user2.token;
  });

  afterAll(async () => {
    // Cleanup DB connection
    await db('event_tags').del();
    await db('tags').del();
    await db('events').del();
    await db('refresh_tokens').del();
    await db('users').del();
    await db.destroy();
  });

  describe('POST /events', () => {
    it('should create an event successfully when authenticated and set correct creator_id and tags', async () => {
      const eventData = {
        title: 'Community Tech Meetup',
        description: 'A meetup for local developers',
        start_datetime: '2026-09-15T18:00:00.000Z',
        location: 'Tech Hub Room 101',
        event_type: 'public',
        tags: ['javascript', 'networking'],
      };

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(eventData);

      expect(response.status).toBe(httpStatus.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toBeDefined();
      expect(response.body.data.event.id).toBeDefined();
      expect(response.body.data.event.title).toBe(eventData.title);
      expect(response.body.data.event.description).toBe(eventData.description);
      expect(response.body.data.event.location).toBe(eventData.location);
      expect(response.body.data.event.event_type).toBe('public');
      expect(response.body.data.event.creator_id).toBe(user1Id);
      expect(response.body.data.event.tags).toEqual(['javascript', 'networking']);

      // Verify in DB
      const eventInDb = await db('events').where({ id: response.body.data.event.id }).first();
      expect(eventInDb).toBeDefined();
      expect(eventInDb.creator_id).toBe(user1Id);
    });

    it('should reject event creation without auth token with 401', async () => {
      const eventData = {
        title: 'Unauthorized Event',
        start_datetime: '2026-09-15T18:00:00.000Z',
      };

      const response = await request(app)
        .post('/events')
        .send(eventData);

      expect(response.status).toBe(httpStatus.UNAUTHORIZED);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(errorCodes.AUTH_TOKEN_INVALID);
    });

    it('should reject event creation with invalid data (short title)', async () => {
      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'AB',
          start_datetime: '2026-09-15T18:00:00.000Z',
        });

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
      expect(response.body.error.code).toBe(errorCodes.VALIDATION_ERROR);
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
          }),
        ])
      );
    });
  });

  describe('GET /events/:id', () => {
    it('should retrieve a single event by id successfully with tags', async () => {
      const createRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Design Workshop',
          description: 'Hands-on UI/UX workshop',
          start_datetime: '2026-10-01T14:00:00.000Z',
          location: 'Studio 4',
          event_type: 'public',
          tags: ['design', 'ui'],
        });

      const eventId = createRes.body.data.event.id;

      // Public endpoint, no auth required
      const response = await request(app).get(`/events/${eventId}`);

      expect(response.status).toBe(httpStatus.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toBeDefined();
      expect(response.body.data.event.id).toBe(eventId);
      expect(response.body.data.event.title).toBe('Design Workshop');
      expect(response.body.data.event.creator_id).toBe(user1Id);
      expect(response.body.data.event.tags).toEqual(['design', 'ui']);
    });

    it('should return 404 for non-existent event id', async () => {
      const response = await request(app).get('/events/999999');

      expect(response.status).toBe(httpStatus.NOT_FOUND);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(errorCodes.EVENT_NOT_FOUND);
    });
  });

  describe('PUT /events/:id', () => {
    it('should allow the creator to update the event and its tags', async () => {
      const createRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Original Title',
          description: 'Original description',
          start_datetime: '2026-11-01T10:00:00.000Z',
          location: 'Room A',
          tags: ['initial'],
        });

      const eventId = createRes.body.data.event.id;

      const updateRes = await request(app)
        .put(`/events/${eventId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Updated Event Title',
          location: 'Room B',
          event_type: 'private',
          tags: ['updated', 'v2'],
        });

      expect(updateRes.status).toBe(httpStatus.OK);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.event.title).toBe('Updated Event Title');
      expect(updateRes.body.data.event.location).toBe('Room B');
      expect(updateRes.body.data.event.event_type).toBe('private');
      expect(updateRes.body.data.event.description).toBe('Original description');
      expect(updateRes.body.data.event.tags).toEqual(['updated', 'v2']);
    });

    it('should reject update by a different authenticated user with 403', async () => {
      const createRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Alice Private Event',
          start_datetime: '2026-11-01T10:00:00.000Z',
        });

      const eventId = createRes.body.data.event.id;

      const updateRes = await request(app)
        .put(`/events/${eventId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Bob Hijack Attempt',
        });

      expect(updateRes.status).toBe(httpStatus.FORBIDDEN);
      expect(updateRes.body.error).toBeDefined();
      expect(updateRes.body.error.code).toBe(errorCodes.FORBIDDEN_NOT_OWNER);
    });
  });

  describe('DELETE /events/:id', () => {
    it('should allow the creator to delete the event', async () => {
      const createRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Event To Delete',
          start_datetime: '2026-12-01T10:00:00.000Z',
          tags: ['temporary'],
        });

      const eventId = createRes.body.data.event.id;

      const deleteRes = await request(app)
        .delete(`/events/${eventId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(deleteRes.status).toBe(httpStatus.OK);
      expect(deleteRes.body.success).toBe(true);
      expect(deleteRes.body.data.message).toBe('Event deleted successfully');

      // Verify event is deleted in DB / 404 on get
      const getRes = await request(app).get(`/events/${eventId}`);
      expect(getRes.status).toBe(httpStatus.NOT_FOUND);

      // Verify junction table rows are deleted via CASCADE
      const junctionRows = await db('event_tags').where({ event_id: eventId });
      expect(junctionRows.length).toBe(0);
    });

    it('should reject deletion by a different authenticated user with 403', async () => {
      const createRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Alice Important Event',
          start_datetime: '2026-12-01T10:00:00.000Z',
        });

      const eventId = createRes.body.data.event.id;

      const deleteRes = await request(app)
        .delete(`/events/${eventId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(deleteRes.status).toBe(httpStatus.FORBIDDEN);
      expect(deleteRes.body.error).toBeDefined();
      expect(deleteRes.body.error.code).toBe(errorCodes.FORBIDDEN_NOT_OWNER);

      const eventInDb = await db('events').where({ id: eventId }).first();
      expect(eventInDb).toBeDefined();
    });
  });

  describe('GET /events - Pagination, Filtering, Search, Sorting', () => {
    beforeEach(async () => {
      // Seed 4 events for comprehensive filter/search/sort tests
      // Event 1: Alice Public, tags: tech, ai, start: 2026-09-01
      await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Alpha AI Conference',
          description: 'Deep dive into machine learning and neural networks',
          location: 'San Francisco Convention Center',
          start_datetime: '2026-09-01T09:00:00.000Z',
          event_type: 'public',
          tags: ['tech', 'ai'],
        });

      // Event 2: Alice Private, tags: internal, confidential, start: 2026-09-10
      await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Beta Secret Strategy Meeting',
          description: 'Quarterly internal product roadmap discussion',
          location: 'HQ Boardroom',
          start_datetime: '2026-09-10T14:00:00.000Z',
          event_type: 'private',
          tags: ['internal', 'strategy'],
        });

      // Event 3: Bob Public, tags: tech, web, start: 2026-09-20
      await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Gamma Web Summit',
          description: 'Frontend and backend modern web technologies',
          location: 'Austin Tech Center',
          start_datetime: '2026-09-20T10:00:00.000Z',
          event_type: 'public',
          tags: ['tech', 'web'],
        });

      // Event 4: Bob Private, tags: strategy, start: 2026-09-30
      await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Delta Executive Dinner',
          description: 'Private networking dinner for executives',
          location: 'The French Laundry',
          start_datetime: '2026-09-30T19:00:00.000Z',
          event_type: 'private',
          tags: ['strategy'],
        });
    });

    it('should return paginated list of events with correct metadata envelope', async () => {
      const response = await request(app).get('/events');

      expect(response.status).toBe(httpStatus.OK);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2); // Only public events for anonymous
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('GET /events?tags=X returns only events with tag X with any-match semantics and no duplicate rows', async () => {
      // Request events with tag 'tech' - should match Event 1 (tech, ai) and Event 3 (tech, web)
      const res = await request(app).get('/events?tags=tech');

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data.length).toBe(2);
      const titles = res.body.data.map((e: { title: string }) => e.title);
      expect(titles).toContain('Alpha AI Conference');
      expect(titles).toContain('Gamma Web Summit');

      // Request events with tags 'ai,web' - any tag matches semantics
      const resMulti = await request(app).get('/events?tags=ai,web');
      expect(resMulti.status).toBe(httpStatus.OK);
      expect(resMulti.body.data.length).toBe(2);

      // Event with multiple matching tags shouldn't duplicate
      const resOverlap = await request(app).get('/events?tags=tech,ai');
      expect(resOverlap.status).toBe(httpStatus.OK);
      expect(resOverlap.body.data.length).toBe(2);
      const event1Matches = resOverlap.body.data.filter((e: { title: string }) => e.title === 'Alpha AI Conference');
      expect(event1Matches.length).toBe(1);
    });

    it('GET /events?type=private with visibility rules still enforced', async () => {
      // Anonymous user querying type=private -> gets 0 events because private events not visible
      const anonRes = await request(app).get('/events?type=private');
      expect(anonRes.status).toBe(httpStatus.OK);
      expect(anonRes.body.data).toEqual([]);
      expect(anonRes.body.meta.total).toBe(0);

      // User 1 querying type=private -> gets only Alice's private event (Event 2), NOT Bob's private event (Event 4)
      const user1Res = await request(app)
        .get('/events?type=private')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(user1Res.status).toBe(httpStatus.OK);
      expect(user1Res.body.data.length).toBe(1);
      expect(user1Res.body.data[0].title).toBe('Beta Secret Strategy Meeting');
      expect(user1Res.body.data[0].creator_id).toBe(user1Id);

      // User 2 querying type=private -> gets only Bob's private event (Event 4)
      const user2Res = await request(app)
        .get('/events?type=private')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(user2Res.status).toBe(httpStatus.OK);
      expect(user2Res.body.data.length).toBe(1);
      expect(user2Res.body.data[0].title).toBe('Delta Executive Dinner');
      expect(user2Res.body.data[0].creator_id).toBe(user2Id);
    });

    it('GET /events?search=... matches on title/description/location', async () => {
      // Match by title
      const titleMatchRes = await request(app).get('/events?search=Alpha');
      expect(titleMatchRes.status).toBe(httpStatus.OK);
      expect(titleMatchRes.body.data.length).toBe(1);
      expect(titleMatchRes.body.data[0].title).toBe('Alpha AI Conference');

      // Match by description
      const descMatchRes = await request(app).get('/events?search=machine learning');
      expect(descMatchRes.status).toBe(httpStatus.OK);
      expect(descMatchRes.body.data.length).toBe(1);
      expect(descMatchRes.body.data[0].title).toBe('Alpha AI Conference');

      // Match by location
      const locMatchRes = await request(app).get('/events?search=Austin');
      expect(locMatchRes.status).toBe(httpStatus.OK);
      expect(locMatchRes.body.data.length).toBe(1);
      expect(locMatchRes.body.data[0].title).toBe('Gamma Web Summit');
    });

    it('GET /events?page=2&limit=1 returns correct meta (total, totalPages) and correct slice', async () => {
      // User 1 sees 3 visible events (Event 1, Event 2, Event 3)
      const page1Res = await request(app)
        .get('/events?page=1&limit=1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(page1Res.status).toBe(httpStatus.OK);
      expect(page1Res.body.data.length).toBe(1);
      expect(page1Res.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 3,
        totalPages: 3,
      });
      expect(page1Res.body.data[0].title).toBe('Alpha AI Conference');

      const page2Res = await request(app)
        .get('/events?page=2&limit=1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(page2Res.status).toBe(httpStatus.OK);
      expect(page2Res.body.data.length).toBe(1);
      expect(page2Res.body.meta).toEqual({
        page: 2,
        limit: 1,
        total: 3,
        totalPages: 3,
      });
      expect(page2Res.body.data[0].title).toBe('Beta Secret Strategy Meeting');

      const page3Res = await request(app)
        .get('/events?page=3&limit=1')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(page3Res.status).toBe(httpStatus.OK);
      expect(page3Res.body.data.length).toBe(1);
      expect(page3Res.body.meta).toEqual({
        page: 3,
        limit: 1,
        total: 3,
        totalPages: 3,
      });
      expect(page3Res.body.data[0].title).toBe('Gamma Web Summit');
    });

    it('default sort is start_datetime ascending; sortBy=created_at works', async () => {
      // Default sort (start_datetime asc)
      const defaultSortRes = await request(app).get('/events');
      expect(defaultSortRes.status).toBe(httpStatus.OK);
      expect(defaultSortRes.body.data[0].title).toBe('Alpha AI Conference'); // Sep 1
      expect(defaultSortRes.body.data[1].title).toBe('Gamma Web Summit'); // Sep 20

      // Sort by date desc
      const dateDescRes = await request(app).get('/events?sortBy=date&sortOrder=desc');
      expect(dateDescRes.status).toBe(httpStatus.OK);
      expect(dateDescRes.body.data[0].title).toBe('Gamma Web Summit');
      expect(dateDescRes.body.data[1].title).toBe('Alpha AI Conference');

      // Sort by created_at desc
      const createdDescRes = await request(app).get('/events?sortBy=created_at&sortOrder=desc');
      expect(createdDescRes.status).toBe(httpStatus.OK);
      expect(createdDescRes.body.data[0].title).toBe('Gamma Web Summit'); // created last among public
      expect(createdDescRes.body.data[1].title).toBe('Alpha AI Conference'); // created first among public
    });

    it('should reject invalid query parameters with 400 Bad Request and validation details', async () => {
      const invalidRes = await request(app).get('/events?sortBy=invalidField');
      expect(invalidRes.status).toBe(httpStatus.BAD_REQUEST);
      expect(invalidRes.body.error).toBeDefined();
      expect(invalidRes.body.error.code).toBe(errorCodes.VALIDATION_ERROR);
      expect(Array.isArray(invalidRes.body.error.details)).toBe(true);
    });
  });

  describe('Private Event Visibility Rules', () => {
    it('should make private event created by user A invisible in user B GET /events list, but visible to user A', async () => {
      const privateRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Alice Private Birthday Party',
          start_datetime: '2026-10-10T19:00:00.000Z',
          event_type: 'private',
        });

      const publicRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Alice Public Meetup',
          start_datetime: '2026-10-11T19:00:00.000Z',
          event_type: 'public',
        });

      const privateEventId = privateRes.body.data.event.id;
      const publicEventId = publicRes.body.data.event.id;

      // User B lists events - should only see the public event
      const userBListRes = await request(app)
        .get('/events')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(userBListRes.status).toBe(httpStatus.OK);
      const userBEvents = userBListRes.body.data;
      expect(userBEvents.some((e: { id: number }) => e.id === privateEventId)).toBe(false);
      expect(userBEvents.some((e: { id: number }) => e.id === publicEventId)).toBe(true);

      // User A lists events - should see both public and their own private event
      const userAListRes = await request(app)
        .get('/events')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(userAListRes.status).toBe(httpStatus.OK);
      const userAEvents = userAListRes.body.data;
      expect(userAEvents.some((e: { id: number }) => e.id === privateEventId)).toBe(true);
      expect(userAEvents.some((e: { id: number }) => e.id === publicEventId)).toBe(true);
    });

    it('should return 404 (not 403) when user B requests user A private event via GET /events/:id', async () => {
      const privateRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Alice Secret Meeting',
          start_datetime: '2026-10-15T15:00:00.000Z',
          event_type: 'private',
        });

      const privateEventId = privateRes.body.data.event.id;

      // User B attempts to access user A's private event
      const userBGetRes = await request(app)
        .get(`/events/${privateEventId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(userBGetRes.status).toBe(httpStatus.NOT_FOUND);
      expect(userBGetRes.body.error).toBeDefined();
      expect(userBGetRes.body.error.code).toBe(errorCodes.EVENT_NOT_FOUND);

      // User A accesses their own private event successfully
      const userAGetRes = await request(app)
        .get(`/events/${privateEventId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(userAGetRes.status).toBe(httpStatus.OK);
      expect(userAGetRes.body.success).toBe(true);
      expect(userAGetRes.body.data.event.id).toBe(privateEventId);
      expect(userAGetRes.body.data.event.title).toBe('Alice Secret Meeting');
    });

    it('should exclude private events from unauthenticated GET /events and return 404 on unauthenticated GET /events/:id', async () => {
      const privateRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Alice Classified Gathering',
          start_datetime: '2026-10-20T12:00:00.000Z',
          event_type: 'private',
        });

      const publicRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Alice Public Seminar',
          start_datetime: '2026-10-21T12:00:00.000Z',
          event_type: 'public',
        });

      const privateEventId = privateRes.body.data.event.id;
      const publicEventId = publicRes.body.data.event.id;

      // Unauthenticated list request
      const anonListRes = await request(app).get('/events');
      expect(anonListRes.status).toBe(httpStatus.OK);
      const anonEvents = anonListRes.body.data;
      expect(anonEvents.some((e: { id: number }) => e.id === privateEventId)).toBe(false);
      expect(anonEvents.some((e: { id: number }) => e.id === publicEventId)).toBe(true);

      // Unauthenticated single event request on private event -> 404
      const anonGetPrivateRes = await request(app).get(`/events/${privateEventId}`);
      expect(anonGetPrivateRes.status).toBe(httpStatus.NOT_FOUND);
      expect(anonGetPrivateRes.body.error.code).toBe(errorCodes.EVENT_NOT_FOUND);

      // Unauthenticated single event request on public event -> 200
      const anonGetPublicRes = await request(app).get(`/events/${publicEventId}`);
      expect(anonGetPublicRes.status).toBe(httpStatus.OK);
      expect(anonGetPublicRes.body.data.event.id).toBe(publicEventId);
    });
  });
});
