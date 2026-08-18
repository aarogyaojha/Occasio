import { Router } from 'express';
import { eventsController } from './events.controller';
import { authenticate, optionalAuth } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createEventSchema, updateEventSchema } from './events.schema';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

/**
 * @swagger
 * /events:
 *   get:
 *     summary: Retrieve a list of all visible events (public events + private events owned by caller)
 *     tags:
 *       - Events
 *     security:
 *       - {}
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           title:
 *                             type: string
 *                             example: Tech Conference 2026
 *                           description:
 *                             type: string
 *                             nullable: true
 *                             example: Annual technology conference
 *                           start_datetime:
 *                             type: string
 *                             format: date-time
 *                             example: 2026-09-01T10:00:00.000Z
 *                           location:
 *                             type: string
 *                             nullable: true
 *                             example: Convention Center, Hall A
 *                           event_type:
 *                             type: string
 *                             enum: [public, private]
 *                             example: public
 *                           creator_id:
 *                             type: integer
 *                             example: 1
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 */
router.get('/', optionalAuth, asyncHandler(eventsController.list));

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Retrieve a single event by ID (private events only visible to creator)
 *     tags:
 *       - Events
 *     security:
 *       - {}
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique event ID
 *     responses:
 *       200:
 *         description: Event retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     event:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         title:
 *                           type: string
 *                         description:
 *                           type: string
 *                           nullable: true
 *                         start_datetime:
 *                           type: string
 *                           format: date-time
 *                         location:
 *                           type: string
 *                           nullable: true
 *                         event_type:
 *                           type: string
 *                           enum: [public, private]
 *                         creator_id:
 *                           type: integer
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', optionalAuth, asyncHandler(eventsController.getById));

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create a new event
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - start_datetime
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 example: Tech Conference 2026
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: Annual technology conference
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-09-01T10:00:00.000Z
 *               location:
 *                 type: string
 *                 nullable: true
 *                 example: Convention Center, Hall A
 *               event_type:
 *                 type: string
 *                 enum: [public, private]
 *                 default: public
 *                 example: public
 *     responses:
 *       201:
 *         description: Event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     event:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         title:
 *                           type: string
 *                         description:
 *                           type: string
 *                           nullable: true
 *                         start_datetime:
 *                           type: string
 *                           format: date-time
 *                         location:
 *                           type: string
 *                           nullable: true
 *                         event_type:
 *                           type: string
 *                           enum: [public, private]
 *                         creator_id:
 *                           type: integer
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - missing or invalid access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/',
  authenticate,
  validate(createEventSchema),
  asyncHandler(eventsController.create)
);

/**
 * @swagger
 * /events/{id}:
 *   put:
 *     summary: Update an existing event (creator only)
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 example: Updated Conference Title
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: Updated description
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-09-02T10:00:00.000Z
 *               location:
 *                 type: string
 *                 nullable: true
 *                 example: Main Auditorium
 *               event_type:
 *                 type: string
 *                 enum: [public, private]
 *                 example: private
 *     responses:
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     event:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         title:
 *                           type: string
 *                         description:
 *                           type: string
 *                           nullable: true
 *                         start_datetime:
 *                           type: string
 *                           format: date-time
 *                         location:
 *                           type: string
 *                           nullable: true
 *                         event_type:
 *                           type: string
 *                           enum: [public, private]
 *                         creator_id:
 *                           type: integer
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - missing or invalid access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - user is not the event creator
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  '/:id',
  authenticate,
  validate(updateEventSchema),
  asyncHandler(eventsController.update)
);

/**
 * @swagger
 * /events/{id}:
 *   delete:
 *     summary: Delete an event (creator only)
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The unique event ID
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Event deleted successfully
 *       401:
 *         description: Unauthorized - missing or invalid access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - user is not the event creator
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete('/:id', authenticate, asyncHandler(eventsController.delete));

export default router;
