import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEvent, useDeleteEvent } from '../features/events/useEvents';
import { useAuthStore } from '../features/auth/authStore';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';

export const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventId = Number(id);

  const { data: event, isLoading, error } = useEvent(eventId);
  const deleteMutation = useDeleteEvent();
  const user = useAuthStore((state) => state.user);

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-8 space-y-4 animate-pulse font-mono max-w-3xl mx-auto">
        <div className="h-7 bg-zinc-800 rounded-sm w-1/2" />
        <div className="h-4 bg-zinc-800 rounded-sm w-1/3" />
        <div className="h-32 bg-zinc-800/60 rounded-sm w-full" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-8 text-center space-y-4 font-mono max-w-xl mx-auto my-12">
        <div className="text-4xl text-zinc-600 font-bold">404</div>
        <h1 className="text-lg font-bold text-white uppercase">Event Not Found</h1>
        <p className="text-xs text-zinc-400">
          The requested event does not exist, or you do not have permission to view it.
        </p>
        <div className="pt-2">
          <Link
            to="/events"
            className="inline-block bg-zinc-100 text-zinc-950 font-bold uppercase px-4 py-2 rounded-sm text-xs hover:bg-zinc-300 transition-colors"
          >
            ← Return to Events
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user && Number(user.id) === Number(event.creator_id);

  const formattedDate = new Date(event.start_datetime).toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(event.id);
      navigate('/events', { replace: true });
    } catch {
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto font-mono text-xs space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/events"
          className="text-zinc-400 hover:text-white uppercase font-bold text-xs transition-colors flex items-center gap-1"
        >
          ← Back to Events
        </Link>
        <span
          className={`uppercase tracking-widest px-3 py-1 rounded-sm border font-semibold ${
            event.event_type === 'public'
              ? 'border-zinc-700 bg-zinc-950 text-zinc-300'
              : 'border-zinc-600 bg-zinc-800 text-zinc-100'
          }`}
        >
          {event.event_type} Event
        </span>
      </div>

      <article className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 sm:p-8 space-y-6">
        <header className="border-b border-zinc-800 pb-5 space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {event.title}
          </h1>

          <div className="flex flex-wrap gap-4 text-xs text-zinc-300 font-mono">
            <div>
              <span className="text-zinc-500 uppercase">Date & Time:</span> {formattedDate}
            </div>
            {event.location && (
              <div>
                <span className="text-zinc-500 uppercase">Location:</span> {event.location}
              </div>
            )}
            <div>
              <span className="text-zinc-500 uppercase">Creator ID:</span> {event.creator_id}
            </div>
          </div>
        </header>

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-zinc-500 uppercase text-[11px] font-bold">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {event.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1 rounded-sm text-xs"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="space-y-2">
          <h3 className="text-zinc-500 uppercase text-[11px] font-bold">Event Details</h3>
          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-sm text-zinc-200 font-sans leading-relaxed text-sm whitespace-pre-wrap">
            {event.description || <span className="italic text-zinc-600">No description provided.</span>}
          </div>
        </div>

        {/* Actions for Owner */}
        {isOwner && (
          <footer className="pt-6 border-t border-zinc-800 flex items-center justify-end space-x-3">
            <Link
              to={`/events/${event.id}/edit`}
              className="px-4 py-2 border border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800 rounded-sm uppercase font-bold transition-colors text-xs"
            >
              Edit Event
            </Link>
            <button
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="px-4 py-2 border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-sm uppercase font-bold transition-colors text-xs"
            >
              Delete Event
            </button>

            <DeleteConfirmDialog
              open={showConfirmDelete}
              onOpenChange={setShowConfirmDelete}
              onConfirm={handleDelete}
              itemLabel={event.title}
              isDeleting={deleteMutation.isPending}
            />
          </footer>
        )}
      </article>
    </div>
  );
};

export default EventDetailPage;
