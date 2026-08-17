import db from '../../db/knex';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface RefreshToken {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export const authRepository = {
  /**
   * Inserts a new user record into the database.
   *
   * @param data - User data containing name, email, and hashed password.
   * @returns The created user record.
   */
  async createUser(data: { name: string; email: string; password_hash: string }): Promise<User> {
    const [id] = await db('users').insert(data);
    const user = await db('users').where({ id }).first();
    return user!;
  },

  /**
   * Finds a user record by email address.
   *
   * @param email - The unique email address to look up.
   * @returns The user record if found, otherwise undefined.
   */
  async findUserByEmail(email: string): Promise<User | undefined> {
    return db('users').where({ email }).first();
  },

  /**
   * Finds a user record by primary key ID.
   *
   * @param id - The unique user ID.
   * @returns The user record if found, otherwise undefined.
   */
  async findUserById(id: number): Promise<User | undefined> {
    return db('users').where({ id }).first();
  },

  /**
   * Stores a new hashed refresh token in the database.
   *
   * @param data - Token record containing user_id, token_hash, and expires_at.
   * @returns The created refresh token record.
   */
  async storeRefreshToken(data: {
    user_id: number;
    token_hash: string;
    expires_at: Date;
  }): Promise<RefreshToken> {
    const [id] = await db('refresh_tokens').insert(data);
    const token = await db('refresh_tokens').where({ id }).first();
    return token!;
  },

  /**
   * Finds a refresh token record by its hashed value.
   *
   * @param token_hash - The SHA-256 hash of the refresh token.
   * @returns The refresh token record if found, otherwise undefined.
   */
  async findRefreshTokenByHash(token_hash: string): Promise<RefreshToken | undefined> {
    return db('refresh_tokens').where({ token_hash }).first();
  },

  /**
   * Revokes a refresh token by setting its revoked_at timestamp to now.
   *
   * @param id - The primary key ID of the refresh token record.
   */
  async revokeRefreshToken(id: number): Promise<void> {
    await db('refresh_tokens').where({ id }).update({ revoked_at: new Date() });
  },
};
