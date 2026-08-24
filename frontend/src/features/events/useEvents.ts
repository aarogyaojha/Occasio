import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  type EventFilters,
  type Event,
  type CreateEventPayload,
  type UpdateEventPayload,
  type PaginatedEvents,
} from '../../api/events';
import type { ApiBackendError } from '../auth/useAuth';

/**
 * Hook to fetch paginated list of events based on active filters.
 * Query key includes filters object to trigger automatic refetching on filter changes.
 */
export const useEvents = (filters: EventFilters = {}) => {
  return useQuery<PaginatedEvents, ApiBackendError>({
    queryKey: ['events', filters],
    queryFn: () => listEvents(filters),
  });
};

/**
 * Hook to fetch single event by ID.
 */
export const useEvent = (id: number) => {
  return useQuery<Event, ApiBackendError>({
    queryKey: ['events', id],
    queryFn: () => getEvent(id),
    enabled: Boolean(id) && !isNaN(id),
  });
};

/**
 * Hook to create a new event. Invalidates event list queries on success.
 */
export const useCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation<Event, ApiBackendError, CreateEventPayload>({
    mutationFn: (data: CreateEventPayload) => createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
};

/**
 * Hook to update an existing event. Invalidates list and specific event queries on success.
 */
export const useUpdateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation<Event, ApiBackendError, { id: number; data: UpdateEventPayload }>({
    mutationFn: ({ id, data }) => updateEvent(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
};

/**
 * Hook to delete an event. Invalidates event list queries on success.
 */
export const useDeleteEvent = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, ApiBackendError, number>({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.removeQueries({ queryKey: ['events', id] });
    },
  });
};
