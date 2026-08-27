import { z } from 'zod';
import { RSVP_STATUSES } from '../../constants';

export const rsvpSchema = z.object({
  status: z.enum(RSVP_STATUSES),
});

export type RsvpInput = z.infer<typeof rsvpSchema>;
