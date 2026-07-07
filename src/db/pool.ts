import mysql from "mysql2/promise";
import { env } from "../config/env.js";

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  connectionLimit: 10,
  waitForConnections: true,
  namedPlaceholders: true,
  timezone: "+07:00",
  charset: "utf8mb4_unicode_ci"
});

export async function pingDatabase() {
  const [rows] = await pool.query("SELECT 1 AS ok");
  return rows;
}
