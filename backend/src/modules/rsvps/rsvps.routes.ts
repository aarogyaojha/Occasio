import { Router } from 'express';
import { rsvpsController } from './rsvps.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { rsvpSchema } from './rsvps.schema';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router({ mergeParams: true });

/**
 * @swagger
 * /events/{eventId}/rsvp:
 *   post:
 *     summary: Set or update RSVP status for an event (yes, no, maybe)
 *     tags:
 *       - RSVPs
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [yes, no, maybe]
 *                 example: yes
 *     responses:
 *       200:
 *         description: RSVP updated successfully
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
 *                     counts:
 *                       type: object
 *                       properties:
 *                         yes:
 *                           type: integer
 *                           example: 4
 *                         no:
 *                           type: integer
 *                           example: 1
 *                         maybe:
 *                           type: integer
 *                           example: 2
 *                     userStatus:
 *                       type: string
 *                       enum: [yes, no, maybe]
 *                       example: yes
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
 *       404:
 *         description: Event not found or private event hidden from user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/',
  authenticate,
  validate(rsvpSchema),
  asyncHandler(rsvpsController.setRsvp)
);

export default router;
