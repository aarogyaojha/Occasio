import { useQuery } from '@tanstack/react-query';
import { listTags, type Tag } from '../../api/tags';
import type { ApiBackendError } from '../auth/useAuth';

/**
 * Hook to fetch all available tags for filtering and input auto-complete.
 */
export const useTags = () => {
  return useQuery<Tag[], ApiBackendError>({
    queryKey: ['tags'],
    queryFn: () => listTags(),
  });
};
