import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../auth/authStore';
import type { Event } from '../../../api/events';

interface EventCardProps {
  event: Event;
  onDelete?: (id: number) => Promise<void>;
  isDeleting?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onDelete, isDeleting }) => {
  const user = useAuthStore((state) => state.user);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const isOwner = user && Number(user.id) === Number(event.creator_id);

  const formattedDate = new Date(event.start_datetime).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handleDeleteConfirm = async () => {
    if (onDelete) {
      await onDelete(event.id);
    }
    setShowConfirmDelete(false);
  };

  return (
    <article className="bg-zinc-900 border border-zinc-800 rounded-sm p-5 space-y-4 hover:border-zinc-700 transition-colors font-mono">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            to={`/events/${event.id}`}
            className="text-lg font-bold text-white hover:text-zinc-300 transition-colors block tracking-tight"
          >
            {event.title}
          </Link>
          <div className="flex items-center space-x-3 text-xs text-zinc-400">
            <span>📅 {formattedDate}</span>
            {event.location && (
              <>
                <span className="text-zinc-700">•</span>
                <span>📍 {event.location}</span>
              </>
            )}
          </div>
        </div>
        <span
          className={`text-[11px] uppercase tracking-widest px-2.5 py-0.5 rounded-sm border font-semibold ${
            event.event_type === 'public'
              ? 'border-zinc-700 bg-zinc-950 text-zinc-300'
              : 'border-zinc-600 bg-zinc-800 text-zinc-100'
          }`}
        >
          {event.event_type}
        </span>
      </header>

      {event.description && (
        <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed font-sans">
          {event.description}
        </p>
      )}

      <footer className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap gap-1.5 items-center">
          {event.tags && event.tags.length > 0 ? (
            event.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] text-zinc-400 bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded-sm"
              >
                #{tag}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-zinc-600 italic">No tags</span>
          )}
        </div>

        {isOwner && (
          <div className="flex items-center space-x-2 shrink-0">
            {!showConfirmDelete ? (
              <>
                <Link
                  to={`/events/${event.id}/edit`}
                  className="px-2.5 py-1 text-xs border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-sm transition-colors uppercase font-bold"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="px-2.5 py-1 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-sm transition-colors uppercase font-bold"
                >
                  Delete
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-2 bg-zinc-950 border border-zinc-800 p-1.5 rounded-sm">
                <span className="text-[11px] text-zinc-400 font-semibold px-1">Are you sure?</span>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-2 py-0.5 bg-zinc-100 text-zinc-950 hover:bg-zinc-300 font-bold rounded-sm uppercase text-[11px] transition-colors disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  disabled={isDeleting}
                  className="px-2 py-0.5 border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-sm uppercase text-[11px] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </footer>
    </article>
  );
};

export default EventCard;
