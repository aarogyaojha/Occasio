import { Router } from 'express';
import { tagsController } from './tags.controller';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

/**
 * @swagger
 * /tags:
 *   get:
 *     summary: Retrieve a list of all available tags
 *     tags:
 *       - Tags
 *     responses:
 *       200:
 *         description: List of tags retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: technology
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 */
router.get('/', asyncHandler(tagsController.list));

export default router;
