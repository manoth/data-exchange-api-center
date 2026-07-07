import knex, { type Knex } from "knex";
import { env } from "../config/env.js";

type QueryResult<T> = [T, unknown];

const dbCharset = env.DB_CHARSET;
const dbCollation = env.DB_COLLATION;

export const db: Knex = knex({
  client: "mysql2",
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    timezone: "+07:00",
    charset: dbCharset
  },
  pool: {
    min: 0,
    max: 10,
    afterCreate(connection: { query: (sql: string, callback: (error: Error | null) => void) => void }, done: (error: Error | null, connection?: unknown) => void) {
      connection.query(`SET NAMES ${dbCharset} COLLATE ${dbCollation}`, (error) => {
        done(error, connection);
      });
    }
  },
  acquireConnectionTimeout: 10000
});

export const pool = {
  async query<T = unknown>(sql: string, bindings?: readonly unknown[]): Promise<QueryResult<T>> {
    const result = await db.raw(sql, (bindings ? [...bindings] : []) as Knex.RawBinding[]);
    return result as QueryResult<T>;
  },

  async end() {
    await db.destroy();
  }
};

export async function pingDatabase() {
  const [rows] = await pool.query("SELECT 1 AS ok");
  return rows;
}
