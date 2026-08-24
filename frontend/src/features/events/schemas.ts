import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters long'),
  description: z.string().trim().optional().or(z.literal('')),
  start_datetime: z
    .string()
    .min(1, 'Start date and time is required')
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date and time',
    }),
  location: z.string().trim().optional().or(z.literal('')),
  event_type: z.enum(['public', 'private'], {
    required_error: 'Event type is required',
  }),
  tags: z.array(z.string().trim().min(1, 'Tag cannot be empty')).optional(),
});

export const updateEventSchema = createEventSchema.partial();

export type CreateEventFormValues = z.infer<typeof createEventSchema>;
export type UpdateEventFormValues = z.infer<typeof updateEventSchema>;
