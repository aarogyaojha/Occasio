import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTags } from '../useTags';

export const EventFilters: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: availableTags } = useTags();

  // Local instant state for search input text
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');

  // Debounce syncing local search input to URL search parameters by ~300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentParam = searchParams.get('search') || '';
      if (searchInput !== currentParam) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (searchInput.trim()) {
            next.set('search', searchInput.trim());
          } else {
            next.delete('search');
          }
          next.set('page', '1');
          return next;
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, searchParams, setSearchParams]);

  // Sync search input if URL changes externally
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== searchInput && document.activeElement?.id !== 'event-search-input') {
      setSearchInput(urlSearch);
    }
  }, [searchParams]);

  const currentType = searchParams.get('type') || 'all';
  const currentTags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
  const currentSortBy = searchParams.get('sortBy') || 'date';
  const currentSortOrder = searchParams.get('sortOrder') || 'asc';

  const updateParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      next.set('page', '1');
      return next;
    });
  };

  const handleTypeChange = (type: string) => {
    updateParam('type', type === 'all' ? null : type);
  };

  const handleTagToggle = (tagName: string) => {
    const updatedTags = currentTags.includes(tagName)
      ? currentTags.filter((t) => t !== tagName)
      : [...currentTags, tagName];

    updateParam('tags', updatedTags.length > 0 ? updatedTags.join(',') : null);
  };

  const handleSortByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateParam('sortBy', e.target.value);
  };

  const handleSortOrderToggle = () => {
    updateParam('sortOrder', currentSortOrder === 'asc' ? 'desc' : 'asc');
  };

  const clearAllFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams({ page: '1' }));
  };

  const hasActiveFilters =
    searchInput.trim() !== '' ||
    currentType !== 'all' ||
    currentTags.length > 0 ||
    currentSortBy !== 'date' ||
    currentSortOrder !== 'asc';

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-4 space-y-4 font-mono text-xs">
      {/* Top Bar: Search Input, Type Tabs, Sort Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Instant responsive Search input */}
        <div className="relative flex-1">
          <input
            id="event-search-input"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search events by title, description, location..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-sm px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          )}
        </div>

        {/* Type Tabs */}
        <div className="flex items-center space-x-1 border border-zinc-800 bg-zinc-950 p-1 rounded-sm">
          {['all', 'public', 'private'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              className={`px-3 py-1 rounded-sm uppercase tracking-wider text-[11px] transition-colors font-bold ${
                currentType === type
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center space-x-2">
          <select
            value={currentSortBy}
            onChange={handleSortByChange}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-sm px-2.5 py-2 focus:outline-none focus:border-zinc-500 uppercase text-[11px]"
          >
            <option value="date">Sort: Event Date</option>
            <option value="created_at">Sort: Created Date</option>
          </select>

          <button
            type="button"
            onClick={handleSortOrderToggle}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white px-2.5 py-2 rounded-sm uppercase text-[11px] font-bold"
            title={`Sort Direction: ${currentSortOrder.toUpperCase()}`}
          >
            {currentSortOrder === 'asc' ? '↑ ASC' : '↓ DESC'}
          </button>
        </div>
      </div>

      {/* Available Tags Multi-Select */}
      {availableTags && availableTags.length > 0 && (
        <div className="pt-2 border-t border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">
              Filter by Tags:
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] text-zinc-400 hover:text-white underline"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {availableTags.map((tag) => {
              const isSelected = currentTags.includes(tag.name);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagToggle(tag.name)}
                  className={`px-2.5 py-1 rounded-sm border text-[11px] transition-colors ${
                    isSelected
                      ? 'border-zinc-100 bg-zinc-100 text-zinc-950 font-bold'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  #{tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventFilters;
