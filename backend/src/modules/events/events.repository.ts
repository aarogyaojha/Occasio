import db from '../../db/knex';

export type EventType = 'public' | 'private';

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

export const eventsRepository = {
  /**
   * Inserts a new event record into the database.
   *
   * @param data - The event creation data including creator_id.
   * @returns The created event record.
   */
  async create(data: CreateEventDbInput): Promise<Event> {
    const payload = {
      ...data,
      start_datetime: new Date(data.start_datetime),
    };
    const [id] = await db('events').insert(payload);
    const event = await db('events').where({ id }).first();
    return event!;
  },

  /**
   * Finds an event record by primary key ID, respecting visibility rules.
   * A private event is only visible if the requester is the creator.
   *
   * @param id - The unique event ID.
   * @param currentUserId - Optional ID of the currently authenticated user.
   * @returns The event record if found and accessible, otherwise undefined.
   */
  async findById(id: number, currentUserId?: number): Promise<Event | undefined> {
    const query = db('events').where({ id });
    if (currentUserId !== undefined) {
      query.andWhere((builder) => {
        builder.where('event_type', 'public').orWhere('creator_id', currentUserId);
      });
    } else {
      query.andWhere('event_type', 'public');
    }
    return query.first();
  },

  /**
   * Retrieves all visible event records ordered by start_datetime in ascending order.
   * Public events are visible to everyone; private events are only visible to their creator.
   *
   * @param currentUserId - Optional ID of the currently authenticated user.
   * @returns An array of visible event records.
   */
  async findAll(currentUserId?: number): Promise<Event[]> {
    const query = db('events');
    if (currentUserId !== undefined) {
      query.where((builder) => {
        builder.where('event_type', 'public').orWhere('creator_id', currentUserId);
      });
    } else {
      query.where('event_type', 'public');
    }
    return query.orderBy('start_datetime', 'asc');
  },

  /**
   * Updates an existing event record by its primary key ID.
   *
   * @param id - The unique event ID to update.
   * @param data - The partial event data to update.
   * @returns The updated event record if found, otherwise undefined.
   */
  async update(id: number, data: UpdateEventDbInput): Promise<Event | undefined> {
    const updatePayload: Record<string, unknown> = {
      ...data,
      updated_at: db.fn.now(),
    };
    if (data.start_datetime !== undefined) {
      updatePayload.start_datetime = new Date(data.start_datetime);
    }

    await db('events').where({ id }).update(updatePayload);
    return db('events').where({ id }).first();
  },

  /**
   * Deletes an event record by its primary key ID.
   *
   * @param id - The unique event ID to delete.
   */
  async delete(id: number): Promise<void> {
    await db('events').where({ id }).del();
  },
};
