import apiClient from './client';

export interface Tag {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
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
 * Retrieves all available tags.
 */
export const listTags = async (): Promise<Tag[]> => {
  try {
    const response = await apiClient.get<{
      success: boolean;
      data: Tag[];
    }>('/tags');
    return response.data.data;
  } catch (error) {
    return handleApiError(error);
  }
};
