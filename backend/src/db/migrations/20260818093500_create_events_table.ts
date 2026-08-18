import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('events', (table) => {
    table.increments('id').primary();
    table.string('title', 255).notNullable();
    table.text('description').nullable();
    table.dateTime('start_datetime').notNullable();
    table.string('location', 255).nullable();
    table.enum('event_type', ['public', 'private']).notNullable().defaultTo('public');
    table
      .integer('creator_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.timestamps(true, true);

    table.index('start_datetime');
    table.index('creator_id');
    table.index('event_type');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('events');
}
