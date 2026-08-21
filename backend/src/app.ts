/// <reference path="./types/express.d.ts" />
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { isProduction } from './config/env';
import { messages } from './constants';
import { swaggerSpec } from './config/swagger';
import { generalLimiter } from './middleware/rateLimiter.middleware';
import authRoutes from './modules/auth/auth.routes';
import eventRoutes from './modules/events/events.routes';
import tagRoutes from './modules/tags/tags.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || !isProduction) {
        return callback(null, true);
      }
      return callback(new Error(messages.CORS_NOT_ALLOWED));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Global Rate Limiting (applied to all routes except /api-docs)
app.use(generalLimiter);

// Routes
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/tags', tagRoutes);

// Central error handler (must be last)
app.use(errorHandler);

export default app;
