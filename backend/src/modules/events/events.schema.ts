import { z } from 'zod';
import { EVENT_TYPES, EVENT_SORT_FIELDS, SORT_ORDERS } from '../../constants';

export const createEventSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters long'),
  description: z.string().trim().nullable().optional(),
  start_datetime: z.string().datetime({ offset: true, message: 'Invalid ISO date string' }),
  location: z.string().trim().nullable().optional(),
  event_type: z.enum(EVENT_TYPES).default('public'),
  tags: z.array(z.string().trim().min(1, 'Tag name cannot be empty')).optional(),
});

export const updateEventSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters long').optional(),
  description: z.string().trim().nullable().optional(),
  start_datetime: z.string().datetime({ offset: true, message: 'Invalid ISO date string' }).optional(),
  location: z.string().trim().nullable().optional(),
  event_type: z.enum(EVENT_TYPES).optional(),
  tags: z.array(z.string().trim().min(1, 'Tag name cannot be empty')).optional(),
});

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      if (Array.isArray(val)) {
        return val.map((s) => s.trim()).filter((s) => s.length > 0);
      }
      return val
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }),
  type: z.enum(EVENT_TYPES).optional(),
  search: z.string().trim().min(1).optional(),
  sortBy: z.enum(EVENT_SORT_FIELDS).default('date'),
  sortOrder: z.enum(SORT_ORDERS).default('asc'),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQueryInput = z.infer<typeof listEventsQuerySchema>;
