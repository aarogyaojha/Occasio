import knex from 'knex';
import { dbConfig } from '../config/database';
import { env } from '../config/env';

const db = knex(dbConfig[env.NODE_ENV] || dbConfig.development);

export default db;
