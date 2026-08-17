export const SWAGGER_TAGS = {
  AUTH: 'Auth',
  EVENTS: 'Events',
  TAGS: 'Tags',
} as const;

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Enter your JWT access token in the format "Bearer <token>"
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: object
 *           properties:
 *             code:
 *               type: string
 *               example: VALIDATION_ERROR
 *             message:
 *               type: string
 *               example: Validation error
 *             details:
 *               type: object
 *               nullable: true
 *           required:
 *             - code
 *             - message
 */
