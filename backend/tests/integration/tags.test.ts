import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import db from '../../src/db/knex';
import { resetRateLimiters } from '../../src/middleware/rateLimiter.middleware';
import { httpStatus } from '../../src/constants';

vi.mock('../../src/utils/sendVerificationEmail', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/config/mailer', () => ({
  transporter: {
    sendMail: vi.fn().mockResolvedValue({}),
  },
}));

describe('Tags Module Integration Tests', () => {
  let userToken: string;
  let userId: number;

  beforeEach(async () => {
    // Reset rate limiters and clear tables before each test
    resetRateLimiters();
    await db('event_tags').del();
    await db('tags').del();
    await db('events').del();
    await db('email_verification_tokens').del();
    await db('refresh_tokens').del();
    await db('users').del();

    // Register User
    const userRes = await request(app)
      .post('/auth/signup')
      .send({
        name: 'Tag Tester',
        email: 'tagtester@example.com',
        password: 'password123',
      });
    userId = userRes.body.data.user.id;
    await db('users').where({ id: userId }).update({ email_verified: true });
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'tagtester@example.com', password: 'password123' });
    userToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await db('event_tags').del();
    await db('tags').del();
    await db('events').del();
    await db('refresh_tokens').del();
    await db('users').del();
    await db.destroy();
  });

  describe('GET /tags', () => {
    it('should return empty list when no tags exist', async () => {
      const response = await request(app).get('/tags');

      expect(response.status).toBe(httpStatus.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return all tags created so far', async () => {
      await db('tags').insert([
        { name: 'conference' },
        { name: 'workshop' },
        { name: 'meetup' },
      ]);

      const response = await request(app).get('/tags');

      expect(response.status).toBe(httpStatus.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBe(3);
      const tagNames = response.body.data.map((t: { name: string }) => t.name);
      expect(tagNames).toEqual(['conference', 'meetup', 'workshop']); // sorted by name asc
    });
  });

  describe('Tag Assignment on Events', () => {
    it('creating an event with tags actually creates tag rows and links them', async () => {
      const eventData = {
        title: 'AI Summit 2026',
        description: 'Conference about artificial intelligence',
        start_datetime: '2026-10-15T09:00:00.000Z',
        location: 'Hall A',
        event_type: 'public',
        tags: ['ai', 'machine-learning', 'tech'],
      };

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${userToken}`)
        .send(eventData);

      expect(response.status).toBe(httpStatus.CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toBeDefined();
      expect(response.body.data.event.tags).toEqual(['ai', 'machine-learning', 'tech']);

      const eventId = response.body.data.event.id;

      // Verify tags exist in tags table
      const tagsInDb = await db('tags').orderBy('name', 'asc');
      expect(tagsInDb.length).toBe(3);
      expect(tagsInDb.map((t) => t.name)).toEqual(['ai', 'machine-learning', 'tech']);

      // Verify junction table rows in event_tags
      const eventTagsInDb = await db('event_tags').where({ event_id: eventId });
      expect(eventTagsInDb.length).toBe(3);
    });

    it('creating two events with an overlapping tag does not create duplicate tag rows', async () => {
      // Event 1 with tags ['tech', 'cloud']
      const res1 = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Cloud Expo',
          start_datetime: '2026-11-01T10:00:00.000Z',
          tags: ['tech', 'cloud'],
        });
      expect(res1.status).toBe(httpStatus.CREATED);

      // Event 2 with tags ['tech', 'ai'] - 'tech' is overlapping
      const res2 = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'AI Dev Day',
          start_datetime: '2026-11-05T10:00:00.000Z',
          tags: ['tech', 'ai'],
        });
      expect(res2.status).toBe(httpStatus.CREATED);

      // Verify total tag rows in DB is exactly 3 ('ai', 'cloud', 'tech'), not 4
      const tagsInDb = await db('tags').orderBy('name', 'asc');
      expect(tagsInDb.length).toBe(3);
      expect(tagsInDb.map((t) => t.name)).toEqual(['ai', 'cloud', 'tech']);

      // Verify event_tags table links correctly
      const event1Id = res1.body.data.event.id;
      const event2Id = res2.body.data.event.id;

      const techTag = tagsInDb.find((t) => t.name === 'tech')!;
      const event1TechLink = await db('event_tags').where({ event_id: event1Id, tag_id: techTag.id }).first();
      const event2TechLink = await db('event_tags').where({ event_id: event2Id, tag_id: techTag.id }).first();

      expect(event1TechLink).toBeDefined();
      expect(event2TechLink).toBeDefined();
    });

    it('creating events with "Tech" then "tech" reuses the same tag id case-insensitively', async () => {
      const res1 = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Tech Conference 1',
          start_datetime: '2026-12-01T10:00:00.000Z',
          tags: ['Tech'],
        });
      expect(res1.status).toBe(httpStatus.CREATED);

      const res2 = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Tech Conference 2',
          start_datetime: '2026-12-02T10:00:00.000Z',
          tags: ['tech'],
        });
      expect(res2.status).toBe(httpStatus.CREATED);

      // Verify that only 1 tag exists in the database ("Tech")
      const tagsInDb = await db('tags');
      expect(tagsInDb.length).toBe(1);
      expect(tagsInDb[0].name).toBe('Tech');

      // Verify both events link to the exact same tag id
      const tagId = tagsInDb[0].id;
      const event1Id = res1.body.data.event.id;
      const event2Id = res2.body.data.event.id;

      const event1Link = await db('event_tags').where({ event_id: event1Id, tag_id: tagId }).first();
      const event2Link = await db('event_tags').where({ event_id: event2Id, tag_id: tagId }).first();

      expect(event1Link).toBeDefined();
      expect(event2Link).toBeDefined();
    });
  });
});
