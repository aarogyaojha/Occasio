import React from 'react';
import EventCard from './EventCard';
import type { Event } from '../../../api/events';
import type { ApiBackendError } from '../../auth/useAuth';

interface EventListProps {
  events?: Event[];
  isLoading: boolean;
  error?: ApiBackendError | null;
  onDelete?: (id: number) => Promise<void>;
  isDeleting?: boolean;
}

export const EventList: React.FC<EventListProps> = ({
  events,
  isLoading,
  error,
  onDelete,
  isDeleting,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="bg-zinc-900 border border-zinc-800 rounded-sm p-5 space-y-3 animate-pulse h-36"
          >
            <div className="h-5 bg-zinc-800 rounded-sm w-1/3" />
            <div className="h-4 bg-zinc-800 rounded-sm w-1/4" />
            <div className="h-8 bg-zinc-800/60 rounded-sm w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-sm text-center space-y-2 font-mono">
        <p className="text-zinc-100 font-semibold text-sm">Failed to load events</p>
        <p className="text-xs text-zinc-400">
          {error.message || 'An unexpected error occurred while fetching events.'}
        </p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 p-12 rounded-sm text-center space-y-3 font-mono">
        <p className="text-zinc-400 text-sm">No events found</p>
        <p className="text-xs text-zinc-500">
          Try adjusting your search criteria or filter tags, or create a new event.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <EventCard key={event.id} event={event} onDelete={onDelete} isDeleting={isDeleting} />
      ))}
    </div>
  );
};

export default EventList;
