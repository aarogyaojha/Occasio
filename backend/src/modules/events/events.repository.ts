import type { Knex } from 'knex';
import db from '../../db/knex';
import { EventType, EventSortField, SortOrder } from '../../constants';
import { tagsRepository } from '../tags/tags.repository';

export interface Event {
  id: number;
  title: string;
  description: string | null;
  start_datetime: Date;
  location: string | null;
  event_type: EventType;
  creator_id: number;
  created_at: Date;
  updated_at: Date;
  tags?: string[];
}

export interface CreateEventDbInput {
  title: string;
  description?: string | null;
  start_datetime: Date | string;
  location?: string | null;
  event_type?: EventType;
  creator_id: number;
}

export interface UpdateEventDbInput {
  title?: string;
  description?: string | null;
  start_datetime?: Date | string;
  location?: string | null;
  event_type?: EventType;
}

export interface EventFilters {
  page?: number;
  limit?: number;
  tags?: string[];
  type?: EventType;
  search?: string;
  sortBy?: EventSortField;
  sortOrder?: SortOrder;
  currentUserId?: number;
}

export interface PaginatedEvents {
  data: Event[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const eventsRepository = {
  /**
   * Sets the tags for a specific event by replacing all existing event_tags mappings.
   *
   * @param eventId - The unique event ID.
   * @param tagNames - Array of tag names to associate with the event.
   * @param trx - Optional Knex transaction object.
   */
  async setEventTags(eventId: number, tagNames: string[], trx?: Knex.Transaction): Promise<void> {
    const knexInstance = trx || db;
    const uniqueNames = Array.from(
      new Set(tagNames.map((t) => t.trim()).filter((t) => t.length > 0))
    );

    const execute = async (t: Knex.Transaction | Knex) => {
      await t('event_tags').where({ event_id: eventId }).del();

      if (uniqueNames.length === 0) {
        return;
      }

      const tagIds: number[] = [];
      for (const name of uniqueNames) {
        const tag = await tagsRepository.findOrCreateByName(name, t as Knex.Transaction);
        tagIds.push(tag.id);
      }

      const rowsToInsert = tagIds.map((tag_id) => ({
        event_id: eventId,
        tag_id,
      }));
      await t('event_tags').insert(rowsToInsert);
    };

    if (trx) {
      await execute(trx);
    } else {
      await db.transaction(execute);
    }
  },

  /**
   * Retrieves tag names associated with a specific event.
   *
   * @param eventId - The unique event ID.
   * @param trx - Optional Knex transaction object.
   * @returns Array of tag name strings.
   */
  async getTagsForEvent(eventId: number, trx?: Knex.Transaction): Promise<string[]> {
    const knexInstance = trx || db;
    const rows = await knexInstance('event_tags')
      .join('tags', 'event_tags.tag_id', 'tags.id')
      .where('event_tags.event_id', eventId)
      .select('tags.name')
      .orderBy('tags.name', 'asc');
    return rows.map((r) => r.name);
  },

  /**
   * Inserts a new event record into the database.
   *
   * @param data - The event creation data including creator_id.
   * @param trx - Optional Knex transaction object.
   * @returns The created event record.
   */
  async create(data: CreateEventDbInput, trx?: Knex.Transaction): Promise<Event> {
    const knexInstance = trx || db;
    const payload = {
      title: data.title,
      description: data.description ?? null,
      start_datetime: new Date(data.start_datetime),
      location: data.location ?? null,
      event_type: data.event_type ?? 'public',
      creator_id: data.creator_id,
    };
    const [id] = await knexInstance('events').insert(payload);
    const event = await knexInstance('events').where({ id }).first();
    return event!;
  },

  /**
   * Finds an event record by primary key ID, respecting visibility rules.
   * A private event is only visible if the requester is the creator.
   *
   * @param id - The unique event ID.
   * @param currentUserId - Optional ID of the currently authenticated user.
   * @param trx - Optional Knex transaction object.
   * @returns The event record with tags if found and accessible, otherwise undefined.
   */
  async findById(id: number, currentUserId?: number, trx?: Knex.Transaction): Promise<Event | undefined> {
    const knexInstance = trx || db;
    const query = knexInstance('events').where({ id });
    if (currentUserId !== undefined) {
      query.andWhere((builder) => {
        builder.where('event_type', 'public').orWhere('creator_id', currentUserId);
      });
    } else {
      query.andWhere('event_type', 'public');
    }
    const event = await query.first();
    if (!event) {
      return undefined;
    }
    const tags = await this.getTagsForEvent(event.id, trx);
    return {
      ...event,
      tags,
    };
  },

  /**
   * Retrieves visible event records with filtering, pagination, search, and sorting.
   *
   * @param filters - The filter, pagination, search, and sort parameters.
   * @returns An object containing the event records data and pagination metadata.
   */
  async findAll(filters: EventFilters = {}): Promise<PaginatedEvents> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
    const offset = (page - 1) * limit;

    const applyFilters = (query: Knex.QueryBuilder) => {
      // Visibility rules: public events are visible to all; private events only to their creator
      if (filters.currentUserId !== undefined) {
        query.andWhere((builder) => {
          builder.where('events.event_type', 'public').orWhere('events.creator_id', filters.currentUserId);
        });
      } else {
        query.andWhere('events.event_type', 'public');
      }

      // Explicit type filter
      if (filters.type) {
        query.andWhere('events.event_type', filters.type);
      }

      // Search filter on title, description, location
      if (filters.search && filters.search.trim().length > 0) {
        const searchPattern = `%${filters.search.trim()}%`;
        query.andWhere((builder) => {
          builder
            .where('events.title', 'like', searchPattern)
            .orWhere('events.description', 'like', searchPattern)
            .orWhere('events.location', 'like', searchPattern);
        });
      }

      // Tags filter: "any tag matches" semantics
      if (filters.tags && filters.tags.length > 0) {
        query
          .join('event_tags', 'events.id', 'event_tags.event_id')
          .join('tags', 'event_tags.tag_id', 'tags.id')
          .whereIn('tags.name', filters.tags);
      }
    };

    // Parallel count and data queries
    const countQuery = db('events');
    applyFilters(countQuery);
    countQuery.countDistinct('events.id as count');

    const dataQuery = db('events');
    applyFilters(dataQuery);
    dataQuery.select(
      'events.id',
      'events.title',
      'events.description',
      'events.start_datetime',
      'events.location',
      'events.event_type',
      'events.creator_id',
      'events.created_at',
      'events.updated_at'
    );
    if (filters.tags && filters.tags.length > 0) {
      dataQuery.distinct();
    }

    const sortColumn = filters.sortBy === 'created_at' ? 'events.created_at' : 'events.start_datetime';
    const sortOrder = filters.sortOrder === 'desc' ? 'desc' : 'asc';
    dataQuery.orderBy(sortColumn, sortOrder).orderBy('events.id', sortOrder);
    dataQuery.offset(offset).limit(limit);

    const [countResult, eventRows] = await Promise.all([
      countQuery.first(),
      dataQuery,
    ]);

    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Batch load tags for the returned events to avoid N+1 queries
    const eventIds = eventRows.map((e) => e.id);
    const tagsByEventId = new Map<number, string[]>();

    if (eventIds.length > 0) {
      const tagRows = await db('event_tags')
        .join('tags', 'event_tags.tag_id', 'tags.id')
        .whereIn('event_tags.event_id', eventIds)
        .select('event_tags.event_id', 'tags.name')
        .orderBy('tags.name', 'asc');

      for (const row of tagRows) {
        if (!tagsByEventId.has(row.event_id)) {
          tagsByEventId.set(row.event_id, []);
        }
        tagsByEventId.get(row.event_id)!.push(row.name);
      }
    }

    const events: Event[] = eventRows.map((e) => ({
      ...e,
      tags: tagsByEventId.get(e.id) || [],
    }));

    return {
      data: events,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  /**
   * Updates an existing event record by its primary key ID.
   *
   * @param id - The unique event ID to update.
   * @param data - The partial event data to update.
   * @param trx - Optional Knex transaction object.
   * @returns The updated event record if found, otherwise undefined.
   */
  async update(id: number, data: UpdateEventDbInput, trx?: Knex.Transaction): Promise<Event | undefined> {
    const knexInstance = trx || db;
    const updatePayload: Record<string, unknown> = {
      updated_at: db.fn.now(),
    };
    if (data.title !== undefined) updatePayload.title = data.title;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.location !== undefined) updatePayload.location = data.location;
    if (data.event_type !== undefined) updatePayload.event_type = data.event_type;
    if (data.start_datetime !== undefined) {
      updatePayload.start_datetime = new Date(data.start_datetime);
    }

    await knexInstance('events').where({ id }).update(updatePayload);
    return knexInstance('events').where({ id }).first();
  },

  /**
   * Deletes an event record by its primary key ID.
   *
   * @param id - The unique event ID to delete.
   * @param trx - Optional Knex transaction object.
   */
  async delete(id: number, trx?: Knex.Transaction): Promise<void> {
    const knexInstance = trx || db;
    await knexInstance('events').where({ id }).del();
  },
};
