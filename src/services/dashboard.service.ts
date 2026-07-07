import { RowDataPacket } from "mysql2";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

type AgentSummaryRow = RowDataPacket & {
  total: number;
  online: number;
  offline: number;
  db_ok: number;
  db_failed: number;
};

type CommandSummaryRow = RowDataPacket & {
  pending: number;
  running: number;
  failed: number;
};

type EventSummaryRow = RowDataPacket & {
  errors_today: number;
  warnings_today: number;
};

export async function getDashboardSummary() {
  const [agentRows] = await pool.query<AgentSummaryRow[]>(
    `SELECT
      COUNT(*) AS total,
      SUM(effective_status = 'online') AS online,
      SUM(effective_status = 'offline') AS offline,
      SUM(db_status = 'ok') AS db_ok,
      SUM(db_status = 'failed') AS db_failed
    FROM (
      SELECT db_status,
        CASE
          WHEN last_seen_at IS NULL THEN 'offline'
          WHEN TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) > ? THEN 'offline'
          ELSE status
        END AS effective_status
      FROM agents
    ) a`,
    [env.AGENT_ONLINE_TIMEOUT_SECONDS]
  );

  const [commandRows] = await pool.query<CommandSummaryRow[]>(
    `SELECT
      SUM(status = 'pending') AS pending,
      SUM(status = 'running') AS running,
      SUM(status = 'failed') AS failed
    FROM agent_commands`
  );

  const [eventRows] = await pool.query<EventSummaryRow[]>(
    `SELECT
      SUM(severity = 'error' AND DATE(created_at) = CURDATE()) AS errors_today,
      SUM(severity = 'warning' AND DATE(created_at) = CURDATE()) AS warnings_today
    FROM agent_events`
  );

  return {
    agents: normalizeCounts(agentRows[0]),
    commands: normalizeCounts(commandRows[0]),
    events: normalizeCounts(eventRows[0])
  };
}

function normalizeCounts<T extends Record<string, unknown>>(row?: T) {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(row || {})) {
    result[key] = Number(value || 0);
  }
  return result;
}
