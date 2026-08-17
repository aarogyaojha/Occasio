import type { Knex } from 'knex';
import path from 'path';
import { env } from './env';

export const dbConfig: { [key: string]: Knex.Config } = {
  development: {
    client: 'mysql2',
    connection: {
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
    },
    migrations: {
      directory: path.resolve(__dirname, '../db/migrations'),
      extension: 'ts',
    },
  },
  test: {
    client: 'mysql2',
    connection: {
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
    },
    migrations: {
      directory: path.resolve(__dirname, '../db/migrations'),
      extension: 'ts',
    },
  },
  production: {
    client: 'mysql2',
    connection: {
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
    },
    migrations: {
      directory: path.resolve(__dirname, '../db/migrations'),
      extension: 'ts',
    },
  },
};
