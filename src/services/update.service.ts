import { RowDataPacket } from "mysql2";
import { pool } from "../db/pool.js";

export async function listVersions() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, version, release_channel AS releaseChannel, manifest_url AS manifestUrl,
      notes, is_latest AS isLatest, published_at AS publishedAt
    FROM agent_versions
    ORDER BY published_at DESC`
  );
  return rows;
}

export async function getLatestVersion(channel = "stable") {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, version, release_channel AS releaseChannel, manifest_url AS manifestUrl,
      notes, is_latest AS isLatest, published_at AS publishedAt
    FROM agent_versions
    WHERE release_channel = ? AND is_latest = 1
    ORDER BY published_at DESC
    LIMIT 1`,
    [channel]
  );
  return rows[0] || null;
}
