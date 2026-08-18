import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import db from '../../src/db/knex';
import { httpStatus, errorCodes } from '../../src/constants';

describe('Events Module Integration Tests', () => {
  let user1Token: string;
  let user1Id: number;
  let user2Token: string;
  let user2Id: number;

  beforeEach(async () => {
    // Clear tables before each test
    await db('events').del();
    await db('refresh_tokens').del();
    await db('users').del();

    // Register User 1 (Creator)
    const user1Res = await request(app)
      .post('/auth/signup')
      .send({
        name: 'Alice Creator',
        email: 'alice@example.com',
        password: 'password123',
      });
    user1Token = user1Res.body.data.accessToken;
    user1Id = user1Res.body.data.user.id;

    // Register User 2 (Other User)
    const user2Res = await request(app)
      .post('/auth/signup')
      .send({
        name: 'Bob Other',
        email: 'bob@example.com',
        password: 'password123',
      });
    user2Token = user2Res.body.data.accessToken;
    user2Id = user2Res.body.data.user.id;
  });

  afterAll(async () => {
    // Cleanup DB connection
    await db('events').del();
    await db('refresh_tokens').del();
    await db('users').del();
    await db.destroy();
  });

  describe('POST /events', () => {
    it('should create an event successfully when authenticated and set correct creator_id', async () => {
      const eventData = {
        title: 'Community Tech Meetup',
        description: 'A meetup for local developers',
        start_datetime: '2026-09-15T18:00:00.000Z',
        location: 'Tech Hub Room 101',
        event_type: 'public',
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
    it('should retrieve a single event by id successfully', async () => {
      // Create an event first
      const createRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Design Workshop',
          description: 'Hands-on UI/UX workshop',
          start_datetime: '2026-10-01T14:00:00.000Z',
          location: 'Studio 4',
          event_type: 'public',
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
    });

    it('should return 404 for non-existent event id', async () => {
      const response = await request(app).get('/events/999999');

      expect(response.status).toBe(httpStatus.NOT_FOUND);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(errorCodes.EVENT_NOT_FOUND);
    });
  });

  describe('GET /events', () => {
    it('should list all events as an array', async () => {
      // Create 2 events
      await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Event Early',
          start_datetime: '2026-09-01T10:00:00.000Z',
        });

      await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Event Later',
          start_datetime: '2026-09-10T10:00:00.000Z',
        });

      const response = await request(app).get('/events');

      expect(response.status).toBe(httpStatus.OK);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.events)).toBe(true);
      expect(response.body.data.events.length).toBe(2);
      expect(response.body.data.events[0].title).toBe('Event Early');
      expect(response.body.data.events[1].title).toBe('Event Later');
    });
  });

  describe('PUT /events/:id', () => {
    it('should allow the creator to update the event', async () => {
      const createRes = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Original Title',
          description: 'Original description',
          start_datetime: '2026-11-01T10:00:00.000Z',
          location: 'Room A',
        });

      const eventId = createRes.body.data.event.id;

      const updateRes = await request(app)
        .put(`/events/${eventId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Updated Event Title',
          location: 'Room B',
          event_type: 'private',
        });

      expect(updateRes.status).toBe(httpStatus.OK);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.event.title).toBe('Updated Event Title');
      expect(updateRes.body.data.event.location).toBe('Room B');
      expect(updateRes.body.data.event.event_type).toBe('private');
      expect(updateRes.body.data.event.description).toBe('Original description');
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

      // Bob tries to update Alice's event
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

      // Bob tries to delete Alice's event
      const deleteRes = await request(app)
        .delete(`/events/${eventId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(deleteRes.status).toBe(httpStatus.FORBIDDEN);
      expect(deleteRes.body.error).toBeDefined();
      expect(deleteRes.body.error.code).toBe(errorCodes.FORBIDDEN_NOT_OWNER);

      // Verify event still exists in DB
      const eventInDb = await db('events').where({ id: eventId }).first();
      expect(eventInDb).toBeDefined();
    });
  });

  describe('Private Event Visibility Rules', () => {
    it('should make private event created by user A invisible in user B GET /events list, but visible to user A', async () => {
      // User A creates a private event and a public event
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
      const userBEvents = userBListRes.body.data.events;
      expect(userBEvents.some((e: { id: number }) => e.id === privateEventId)).toBe(false);
      expect(userBEvents.some((e: { id: number }) => e.id === publicEventId)).toBe(true);

      // User A lists events - should see both public and their own private event
      const userAListRes = await request(app)
        .get('/events')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(userAListRes.status).toBe(httpStatus.OK);
      const userAEvents = userAListRes.body.data.events;
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
      const anonEvents = anonListRes.body.data.events;
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
