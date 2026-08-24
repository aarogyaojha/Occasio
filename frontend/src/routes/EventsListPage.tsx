import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEvents, useDeleteEvent } from '../features/events/useEvents';
import EventFilters from '../features/events/components/EventFilters';
import EventList from '../features/events/components/EventList';
import Pagination from '../features/events/components/Pagination';
import type { EventFilters as FilterParams } from '../api/events';

export const EventsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: FilterParams = {
    page: Number(searchParams.get('page')) || 1,
    limit: Number(searchParams.get('limit')) || 10,
    search: searchParams.get('search') || undefined,
    type: (searchParams.get('type') as 'public' | 'private') || undefined,
    tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
    sortBy: (searchParams.get('sortBy') as 'date' | 'created_at') || undefined,
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
  };

  const { data: eventResponse, isLoading, error } = useEvents(filters);
  const deleteMutation = useDeleteEvent();

  const handlePageChange = (newPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', newPage.toString());
      return next;
    });
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync(id);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5 font-mono">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase">
            Events Dashboard
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Browse, filter, and manage public and personal private events.
          </p>
        </div>
      </header>

      <EventFilters />

      <EventList
        events={eventResponse?.data}
        isLoading={isLoading}
        error={error}
        onDelete={handleDelete}
        isDeleting={deleteMutation.isPending}
      />

      <Pagination meta={eventResponse?.meta} onPageChange={handlePageChange} />
    </div>
  );
};

export default EventsListPage;
