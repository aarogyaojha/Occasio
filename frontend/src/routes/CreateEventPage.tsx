import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCreateEvent } from '../features/events/useEvents';
import EventForm from '../features/events/components/EventForm';

export const CreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const createMutation = useCreateEvent();

  const handleSubmit = async (data: {
    title: string;
    description?: string | null;
    start_datetime: string;
    location?: string | null;
    event_type: 'public' | 'private';
    tags?: string[];
  }) => {
    const createdEvent = await createMutation.mutateAsync(data);
    navigate(`/events/${createdEvent.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-mono">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Create New Event</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Fill in details to publish a new public or private event.
          </p>
        </div>
        <Link
          to="/events"
          className="text-xs text-zinc-400 hover:text-white uppercase font-bold transition-colors"
        >
          Cancel
        </Link>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 sm:p-8">
        <EventForm
          onSubmit={handleSubmit}
          isSubmitting={createMutation.isPending}
          error={createMutation.error}
          submitLabel="Create Event"
        />
      </div>
    </div>
  );
};

export default CreateEventPage;
