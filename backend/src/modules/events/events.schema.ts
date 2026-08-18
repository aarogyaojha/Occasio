import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters long'),
  description: z.string().trim().nullable().optional(),
  start_datetime: z.string().datetime({ offset: true, message: 'Invalid ISO date string' }),
  location: z.string().trim().nullable().optional(),
  event_type: z.enum(['public', 'private']).default('public'),
});

export const updateEventSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters long').optional(),
  description: z.string().trim().nullable().optional(),
  start_datetime: z.string().datetime({ offset: true, message: 'Invalid ISO date string' }).optional(),
  location: z.string().trim().nullable().optional(),
  event_type: z.enum(['public', 'private']).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
