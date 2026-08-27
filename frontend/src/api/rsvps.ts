import apiClient from './client';

export type RsvpStatus = 'yes' | 'no' | 'maybe';

export interface RsvpCounts {
  yes: number;
  no: number;
  maybe: number;
}

export interface SetRsvpResponse {
  counts: RsvpCounts;
  userStatus: RsvpStatus;
}

/**
 * Extracts and throws backend error payload { code, message, details? }
 * if present on an AxiosError, ensuring UI components consume error.message.
 */
const handleApiError = (error: unknown): never => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { data?: { error?: unknown } } }).response?.data?.error
  ) {
    throw (error as { response: { data: { error: unknown } } }).response.data.error;
  }
  throw error;
};

/**
 * Submits or updates the current user's RSVP status for a specified event.
 *
 * @param eventId - The ID of the event to RSVP to.
 * @param status - The selected RSVP status ('yes' | 'no' | 'maybe').
 * @returns Updated RSVP counts and user status.
 */
export const setRsvp = async (
  eventId: number,
  status: RsvpStatus
): Promise<SetRsvpResponse> => {
  try {
    const response = await apiClient.post<{
      success: boolean;
      data: SetRsvpResponse;
    }>(`/events/${eventId}/rsvp`, { status });
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};
