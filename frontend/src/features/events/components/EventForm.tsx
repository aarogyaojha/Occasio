import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEventSchema, type CreateEventFormValues } from '../schemas';
import { useTags } from '../useTags';
import type { ApiBackendError } from '../../auth/useAuth';

interface EventFormProps {
  initialValues?: {
    title?: string;
    description?: string | null;
    start_datetime?: string;
    location?: string | null;
    event_type?: 'public' | 'private';
    tags?: string[];
  };
  onSubmit: (data: {
    title: string;
    description?: string | null;
    start_datetime: string;
    location?: string | null;
    event_type: 'public' | 'private';
    tags?: string[];
  }) => Promise<void>;
  isSubmitting: boolean;
  error?: ApiBackendError | null;
  submitLabel: string;
}

const formatForDatetimeLocal = (isoString?: string) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const EventForm: React.FC<EventFormProps> = ({
  initialValues,
  onSubmit,
  isSubmitting,
  error,
  submitLabel,
}) => {
  const { data: availableTags = [] } = useTags();
  const [tags, setTags] = useState<string[]>(initialValues?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredSuggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (!query) return [];

    const unselected = availableTags.filter(
      (t) => !tags.some((selected) => selected.toLowerCase() === t.name.toLowerCase())
    );

    const startsWithMatches: typeof availableTags = [];
    const containsMatches: typeof availableTags = [];

    for (const tag of unselected) {
      const lowerName = tag.name.toLowerCase();
      if (lowerName.startsWith(query)) {
        startsWithMatches.push(tag);
      } else if (lowerName.includes(query)) {
        containsMatches.push(tag);
      }
    }

    return [...startsWithMatches, ...containsMatches].slice(0, 5);
  }, [tagInput, availableTags, tags]);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [tagInput]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: initialValues?.title || '',
      description: initialValues?.description || '',
      start_datetime: formatForDatetimeLocal(initialValues?.start_datetime),
      location: initialValues?.location || '',
      event_type: initialValues?.event_type || 'public',
      tags: initialValues?.tags || [],
    },
  });

  const startDatetimeValue = watch('start_datetime') || '';
  const [datePart, timePart] = startDatetimeValue.split('T');
  const currentDate = datePart || '';
  const currentTime = timePart || '';

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    const defaultTime = currentTime || '09:00';
    const combined = newDate ? `${newDate}T${defaultTime}` : '';
    setValue('start_datetime', combined, { shouldValidate: true });
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    const defaultDate = currentDate || formatForDatetimeLocal(new Date().toISOString()).split('T')[0];
    const combined = defaultDate && newTime ? `${defaultDate}T${newTime}` : '';
    setValue('start_datetime', combined, { shouldValidate: true });
  };

  const applyPreset = (preset: 'now' | 'today-18' | 'tomorrow-9' | 'tomorrow-18' | 'next-week-9') => {
    const now = new Date();
    let targetDate = new Date();
    let timeStr = '09:00';

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (preset === 'now') {
      targetDate = now;
      timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    } else if (preset === 'today-18') {
      targetDate = now;
      timeStr = '18:00';
    } else if (preset === 'tomorrow-9') {
      targetDate.setDate(now.getDate() + 1);
      timeStr = '09:00';
    } else if (preset === 'tomorrow-18') {
      targetDate.setDate(now.getDate() + 1);
      timeStr = '18:00';
    } else if (preset === 'next-week-9') {
      targetDate.setDate(now.getDate() + 7);
      timeStr = '09:00';
    }

    const dateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;
    setValue('start_datetime', `${dateStr}T${timeStr}`, { shouldValidate: true });
  };

  const formattedPreview = (() => {
    if (!startDatetimeValue) return null;
    const d = new Date(startDatetimeValue);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  })();

  useEffect(() => {
    if (initialValues) {
      reset({
        title: initialValues.title || '',
        description: initialValues.description || '',
        start_datetime: formatForDatetimeLocal(initialValues.start_datetime),
        location: initialValues.location || '',
        event_type: initialValues.event_type || 'public',
        tags: initialValues.tags || [],
      });
      setTags(initialValues.tags || []);
    }
  }, [initialValues, reset]);

  const addTag = (rawTag: string) => {
    const cleaned = rawTag.trim().replace(/^#/, '');
    if (!cleaned) return;

    const alreadyAdded = tags.some((t) => t.toLowerCase() === cleaned.toLowerCase());
    if (alreadyAdded) {
      setTagInput('');
      setIsDropdownOpen(false);
      setSelectedIndex(-1);
      return;
    }

    const existingMatch = availableTags.find(
      (t) => t.name.toLowerCase() === cleaned.toLowerCase()
    );
    const tagToAdd = existingMatch ? existingMatch.name : cleaned;

    const nextTags = [...tags, tagToAdd];
    setTags(nextTags);
    setValue('tags', nextTags);
    setTagInput('');
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
  };

  const removeTag = (tagToRemove: string) => {
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    setValue('tags', nextTags);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isDropdownOpen && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
        return;
      }
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
        return;
      }
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (isDropdownOpen && selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
        addTag(filteredSuggestions[selectedIndex].name);
      } else {
        addTag(tagInput);
      }
    }
  };

  const handleFormSubmit = async (data: CreateEventFormValues) => {
    const isoDatetime = new Date(data.start_datetime).toISOString();
    await onSubmit({
      title: data.title,
      description: data.description ? data.description.trim() : null,
      start_datetime: isoDatetime,
      location: data.location ? data.location.trim() : null,
      event_type: data.event_type,
      tags,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 font-mono text-xs">
      {/* Top-Level Error Banner */}
      {error && (
        <div className="bg-zinc-950 border border-zinc-700 p-4 rounded-sm space-y-2">
          <p className="text-zinc-100 font-bold uppercase tracking-wider">Error Submitting Form</p>
          <p className="text-zinc-400">{error.message || 'An unexpected error occurred.'}</p>
          {error.details && error.details.length > 0 && (
            <ul className="list-disc list-inside text-zinc-400 space-y-1 pt-1">
              {error.details.map((d, i) => (
                <li key={i}>
                  <span className="font-bold text-zinc-300">{d.field}:</span> {d.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Event Title */}
      <div className="space-y-2">
        <label htmlFor="title" className="block text-zinc-300 uppercase tracking-wider font-bold">
          Event Title *
        </label>
        <input
          id="title"
          type="text"
          {...register('title')}
          placeholder="e.g. Annual Tech Summit 2026"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-sm p-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
        />
        {errors.title && <p className="text-zinc-400 text-xs mt-1">{errors.title.message}</p>}
      </div>

      {/* Date & Time and Location */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-zinc-300 uppercase tracking-wider font-bold">
            Start Date & Time *
          </label>
          <input type="hidden" {...register('start_datetime')} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1 font-bold">Date</span>
              <input
                id="start_date"
                type="date"
                value={currentDate}
                onChange={handleDateChange}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-sm p-2.5 text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors cursor-pointer"
              />
            </div>
            <div>
              <span className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1 font-bold">Time</span>
              <input
                id="start_time"
                type="time"
                value={currentTime}
                onChange={handleTimeChange}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-sm p-2.5 text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Presets Bar */}
          <div className="flex flex-wrap gap-1.5 pt-1 items-center">
            <span className="text-[10px] text-zinc-500 uppercase font-bold mr-0.5">Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset('now')}
              className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 rounded-sm text-[10px] uppercase font-bold transition-colors"
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => applyPreset('today-18')}
              className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 rounded-sm text-[10px] uppercase font-bold transition-colors"
            >
              Today 6 PM
            </button>
            <button
              type="button"
              onClick={() => applyPreset('tomorrow-9')}
              className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 rounded-sm text-[10px] uppercase font-bold transition-colors"
            >
              Tmrw 9 AM
            </button>
            <button
              type="button"
              onClick={() => applyPreset('next-week-9')}
              className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 rounded-sm text-[10px] uppercase font-bold transition-colors"
            >
              +1 Wk
            </button>
          </div>

          {/* Live Preview */}
          {formattedPreview && (
            <p className="text-[11px] text-zinc-400 font-mono tracking-wide pt-1">
              <span className="text-zinc-500 uppercase">Selected:</span> {formattedPreview}
            </p>
          )}

          {errors.start_datetime && (
            <p className="text-zinc-400 text-xs mt-1">{errors.start_datetime.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="location" className="block text-zinc-300 uppercase tracking-wider font-bold">
            Location
          </label>
          <input
            id="location"
            type="text"
            {...register('location')}
            placeholder="e.g. Hall 4B, Tech Park or Zoom Link"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-sm p-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          {errors.location && (
            <p className="text-zinc-400 text-xs mt-1">{errors.location.message}</p>
          )}
        </div>
      </div>

      {/* Event Type (Public vs Private) */}
      <div className="space-y-2">
        <label className="block text-zinc-300 uppercase tracking-wider font-bold">
          Visibility (Event Type) *
        </label>
        <div className="flex items-center space-x-6 bg-zinc-950 border border-zinc-800 p-3 rounded-sm">
          <label className="flex items-center space-x-2 cursor-pointer text-zinc-300">
            <input
              type="radio"
              value="public"
              {...register('event_type')}
              className="accent-zinc-100"
            />
            <span className="uppercase font-bold">Public (Visible to everyone)</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer text-zinc-300">
            <input
              type="radio"
              value="private"
              {...register('event_type')}
              className="accent-zinc-100"
            />
            <span className="uppercase font-bold">Private (Visible only to creator)</span>
          </label>
        </div>
        {errors.event_type && (
          <p className="text-zinc-400 text-xs mt-1">{errors.event_type.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label
          htmlFor="description"
          className="block text-zinc-300 uppercase tracking-wider font-bold"
        >
          Description
        </label>
        <textarea
          id="description"
          rows={4}
          {...register('description')}
          placeholder="Detailed schedule, speakers, requirements..."
          className="w-full bg-zinc-950 border border-zinc-800 rounded-sm p-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-sans"
        />
        {errors.description && (
          <p className="text-zinc-400 text-xs mt-1">{errors.description.message}</p>
        )}
      </div>

      {/* Tags Input with Autocomplete */}
      <div className="space-y-2">
        <label htmlFor="tags-input" className="block text-zinc-300 uppercase tracking-wider font-bold">
          Tags (Press Enter or comma to add)
        </label>
        <div className="flex gap-2 relative">
          <div className="relative flex-1">
            <input
              id="tags-input"
              type="text"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
              onKeyDown={handleTagKeyDown}
              placeholder="Type tag name..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-sm p-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />

            {isDropdownOpen && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-950 border border-zinc-800 rounded-sm shadow-xl z-30 overflow-hidden">
                {filteredSuggestions.map((suggestion, index) => {
                  const isHighlighted = index === selectedIndex;
                  return (
                    <div
                      key={suggestion.id || suggestion.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addTag(suggestion.name);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`px-3 py-2 text-xs font-mono cursor-pointer flex items-center justify-between transition-colors ${
                        isHighlighted
                          ? 'bg-zinc-800 text-white font-bold'
                          : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                      }`}
                    >
                      <span>#{suggestion.name}</span>
                      {isHighlighted && <span className="text-[10px] text-zinc-500 uppercase">Press Enter</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
                addTag(filteredSuggestions[selectedIndex].name);
              } else {
                addTag(tagInput);
              }
            }}
            className="px-4 py-3 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 font-bold uppercase rounded-sm border border-zinc-700 transition-colors self-start"
          >
            Add Tag
          </button>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center space-x-1.5 bg-zinc-950 border border-zinc-700 text-zinc-200 px-3 py-1 rounded-sm text-xs"
              >
                <span>#{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-zinc-400 hover:text-white font-bold ml-1"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-4 border-t border-zinc-800 flex items-center justify-end space-x-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-zinc-100 text-zinc-950 hover:bg-zinc-300 font-bold uppercase px-6 py-3 rounded-sm transition-colors disabled:opacity-50 text-xs"
        >
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default EventForm;
