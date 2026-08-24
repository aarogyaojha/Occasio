import apiClient from './client';

export interface Event {
  id: number;
  title: string;
  description: string | null;
  start_datetime: string;
  location: string | null;
  event_type: 'public' | 'private';
  creator_id: number;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface EventFilters {
  page?: number;
  limit?: number;
  tags?: string[];
  type?: 'public' | 'private';
  search?: string;
  sortBy?: 'date' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedEvents {
  data: Event[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateEventPayload {
  title: string;
  description?: string | null;
  start_datetime: string;
  location?: string | null;
  event_type?: 'public' | 'private';
  tags?: string[];
}

export interface UpdateEventPayload {
  title?: string;
  description?: string | null;
  start_datetime?: string;
  location?: string | null;
  event_type?: 'public' | 'private';
  tags?: string[];
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
 * Retrieves a paginated list of visible events with optional filters.
 */
export const listEvents = async (filters: EventFilters = {}): Promise<PaginatedEvents> => {
  try {
    const params: Record<string, unknown> = {};
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    if (filters.type) params.type = filters.type;
    if (filters.search) params.search = filters.search;
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortOrder) params.sortOrder = filters.sortOrder;
    if (filters.tags && filters.tags.length > 0) {
      params.tags = filters.tags.join(',');
    }

    const response = await apiClient.get<{
      success: boolean;
      data: Event[];
      meta: PaginatedEvents['meta'];
    }>('/events', { params });

    return {
      data: response.data.data,
      meta: response.data.meta,
    };
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Retrieves a single event by ID with tags.
 */
export const getEvent = async (id: number): Promise<Event> => {
  try {
    const response = await apiClient.get<{
      success: boolean;
      data: { event: Event };
    }>(`/events/${id}`);
    return response.data.data.event;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Creates a new event.
 */
export const createEvent = async (data: CreateEventPayload): Promise<Event> => {
  try {
    const response = await apiClient.post<{
      success: boolean;
      data: { event: Event };
    }>('/events', data);
    return response.data.data.event;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Updates an existing event by ID.
 */
export const updateEvent = async (id: number, data: UpdateEventPayload): Promise<Event> => {
  try {
    const response = await apiClient.put<{
      success: boolean;
      data: { event: Event };
    }>(`/events/${id}`, data);
    return response.data.data.event;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Deletes an event by ID.
 */
export const deleteEvent = async (id: number): Promise<{ message: string }> => {
  try {
    const response = await apiClient.delete<{
      success: boolean;
      data: { message: string };
    }>(`/events/${id}`);
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};
