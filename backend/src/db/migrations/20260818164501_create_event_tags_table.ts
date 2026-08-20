import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('event_tags', (table) => {
    table
      .integer('event_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('events')
      .onDelete('CASCADE');
    table
      .integer('tag_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tags')
      .onDelete('CASCADE');
    table.primary(['event_id', 'tag_id']);
    table.index('tag_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('event_tags');
}
