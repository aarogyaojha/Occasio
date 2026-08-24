import React, { useEffect } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { useEvent, useUpdateEvent } from '../features/events/useEvents';
import { useAuthStore } from '../features/auth/authStore';
import EventForm from '../features/events/components/EventForm';

export const EditEventPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventId = Number(id);

  const { data: event, isLoading, error: fetchError } = useEvent(eventId);
  const updateMutation = useUpdateEvent();
  const user = useAuthStore((state) => state.user);

  const isOwner = user && event && Number(user.id) === Number(event.creator_id);

  useEffect(() => {
    if (!isLoading && event && user && Number(user.id) !== Number(event.creator_id)) {
      navigate('/events', { replace: true });
    }
  }, [isLoading, event, user, navigate]);

  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-8 space-y-4 animate-pulse max-w-2xl mx-auto font-mono">
        <div className="h-7 bg-zinc-800 rounded-sm w-1/3" />
        <div className="h-64 bg-zinc-800/60 rounded-sm w-full" />
      </div>
    );
  }

  if (fetchError || !event) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-8 text-center space-y-4 font-mono max-w-xl mx-auto my-12">
        <h1 className="text-lg font-bold text-white uppercase">Event Not Found</h1>
        <p className="text-xs text-zinc-400">
          The event you are trying to edit does not exist or is not available.
        </p>
        <Link
          to="/events"
          className="inline-block bg-zinc-100 text-zinc-950 font-bold uppercase px-4 py-2 rounded-sm text-xs hover:bg-zinc-300 transition-colors"
        >
          ← Return to Events
        </Link>
      </div>
    );
  }

  if (!isOwner) {
    return <Navigate to="/events" replace />;
  }

  const handleSubmit = async (data: {
    title: string;
    description?: string | null;
    start_datetime: string;
    location?: string | null;
    event_type: 'public' | 'private';
    tags?: string[];
  }) => {
    await updateMutation.mutateAsync({ id: event.id, data });
    navigate(`/events/${event.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-mono">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Edit Event</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Update event details and tag metadata.
          </p>
        </div>
        <Link
          to={`/events/${event.id}`}
          className="text-xs text-zinc-400 hover:text-white uppercase font-bold transition-colors"
        >
          Cancel
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 sm:p-8">
        <EventForm
          initialValues={{
            title: event.title,
            description: event.description,
            start_datetime: event.start_datetime,
            location: event.location,
            event_type: event.event_type,
            tags: event.tags,
          }}
          onSubmit={handleSubmit}
          isSubmitting={updateMutation.isPending}
          error={updateMutation.error}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
};

export default EditEventPage;
