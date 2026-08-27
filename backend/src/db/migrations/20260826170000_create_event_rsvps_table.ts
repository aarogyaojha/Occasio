import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('event_rsvps', (table) => {
    table.increments('id').primary();
    table
      .integer('event_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('events')
      .onDelete('CASCADE');
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.enum('status', ['yes', 'no', 'maybe']).notNullable();
    table.timestamps(true, true);

    table.unique(['event_id', 'user_id']);
    table.index('event_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('event_rsvps');
}
