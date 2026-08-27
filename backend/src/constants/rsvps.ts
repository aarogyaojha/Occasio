export const RSVP_STATUSES = ['yes', 'no', 'maybe'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
