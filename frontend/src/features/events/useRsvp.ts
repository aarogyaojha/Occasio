import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setRsvp, type RsvpStatus, type SetRsvpResponse } from '../../api/rsvps';
import type { ApiBackendError } from '../auth/useAuth';

/**
 * Hook to submit or update an RSVP for an event.
 * Invalidates both single event queries and event list queries on success.
 */
export const useSetRsvp = () => {
  const queryClient = useQueryClient();

  return useMutation<SetRsvpResponse, ApiBackendError, { eventId: number; status: RsvpStatus }>({
    mutationFn: ({ eventId, status }) => setRsvp(eventId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', variables.eventId] });
    },
  });
};
