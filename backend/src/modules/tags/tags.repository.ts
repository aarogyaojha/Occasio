import type { Knex } from 'knex';
import db from '../../db/knex';

export interface Tag {
  id: number;
  name: string;
  created_at?: Date;
  updated_at?: Date;
}

export const tagsRepository = {
  /**
   * Retrieves all tags ordered by name ascending.
   *
   * @param trx - Optional Knex transaction object.
   * @returns An array of all tag records.
   */
  async findAll(trx?: Knex.Transaction): Promise<Tag[]> {
    const query = (trx || db)('tags').select('id', 'name', 'created_at', 'updated_at');
    return query.orderBy('name', 'asc');
  },

  /**
   * Finds a tag by its name, or creates it if it does not already exist.
   *
   * @param name - The name of the tag.
   * @param trx - Optional Knex transaction object.
   * @returns The existing or newly created tag record.
   */
  async findOrCreateByName(name: string, trx?: Knex.Transaction): Promise<Tag> {
    const normalizedName = name.trim();
    const knexInstance = trx || db;

    const existing = await knexInstance('tags')
      .where({ name: normalizedName })
      .first();

    if (existing) {
      return existing;
    }

    try {
      const [id] = await knexInstance('tags').insert({
        name: normalizedName,
      });
      const created = await knexInstance('tags').where({ id }).first();
      return created!;
    } catch {
      // In case of race condition / duplicate entry, re-fetch the existing row
      const fallback = await knexInstance('tags')
        .where({ name: normalizedName })
        .first();
      return fallback!;
    }
  },
};
