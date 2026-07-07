import crypto from "crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { normalizeAgentRow, normalizeThaiText } from "../utils/text.js";

export type RegisterAgentInput = {
  agentUid: string;
  facilityCode?: string;
  facilityName?: string;
  machineName?: string;
  appVersion?: string;
  frontendVersion?: string;
  dbStatus?: "unknown" | "ok" | "failed";
};

export type HeartbeatInput = RegisterAgentInput & {
  status?: "online" | "offline";
  payload?: unknown;
};

type AgentIdentity = RowDataPacket & {
  id: number;
  agentUid: string;
  apiKeyStatus: "none" | "active" | "revoked";
  apiKeyPrefix?: string | null;
};

function hashAgentKey(apiKey: string) {
  return crypto.createHash("sha256").update(apiKey, "utf8").digest("hex");
}

function generateAgentApiKey() {
  return `dex_agent_${crypto.randomBytes(32).toString("base64url")}`;
}

function keyPrefix(apiKey: string) {
  return apiKey.slice(0, 16);
}

export async function listAgents() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, agent_uid AS agentUid, facility_code AS facilityCode,
      facility_name AS facilityName, machine_name AS machineName,
      app_version AS appVersion, frontend_version AS frontendVersion,
      db_status AS dbStatus, api_key_status AS apiKeyStatus,
      api_key_prefix AS apiKeyPrefix, api_key_last_used_at AS apiKeyLastUsedAt,
      is_primary_agent AS isPrimaryAgent,
      CASE
        WHEN last_seen_at IS NULL THEN 'offline'
        WHEN TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) > ? THEN 'offline'
        ELSE status
      END AS status,
      last_seen_at AS lastSeenAt,
      TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) AS secondsSinceLastSeen,
      registered_at AS registeredAt, updated_at AS updatedAt
    FROM agents
    ORDER BY COALESCE(last_seen_at, registered_at) DESC`,
    [env.AGENT_ONLINE_TIMEOUT_SECONDS]
  );
  return rows.map(normalizeAgentRow);
}

export async function getAgent(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, agent_uid AS agentUid, facility_code AS facilityCode,
      facility_name AS facilityName, machine_name AS machineName,
      app_version AS appVersion, frontend_version AS frontendVersion,
      db_status AS dbStatus, api_key_status AS apiKeyStatus,
      api_key_prefix AS apiKeyPrefix, api_key_last_used_at AS apiKeyLastUsedAt,
      is_primary_agent AS isPrimaryAgent,
      CASE
        WHEN last_seen_at IS NULL THEN 'offline'
        WHEN TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) > ? THEN 'offline'
        ELSE status
      END AS status,
      last_seen_at AS lastSeenAt,
      TIMESTAMPDIFF(SECOND, last_seen_at, NOW()) AS secondsSinceLastSeen,
      registered_at AS registeredAt, updated_at AS updatedAt
    FROM agents WHERE id = ?`,
    [env.AGENT_ONLINE_TIMEOUT_SECONDS, id]
  );
  return rows[0] ? normalizeAgentRow(rows[0]) : null;
}

export async function registerAgent(input: RegisterAgentInput) {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO agents
      (agent_uid, facility_code, facility_name, machine_name, app_version, frontend_version, db_status, status, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'online', NOW())
    ON DUPLICATE KEY UPDATE
      facility_code = VALUES(facility_code),
      facility_name = VALUES(facility_name),
      machine_name = VALUES(machine_name),
      app_version = VALUES(app_version),
      frontend_version = VALUES(frontend_version),
      db_status = VALUES(db_status),
      status = 'online',
      last_seen_at = NOW()`,
    [
      input.agentUid,
      input.facilityCode || null,
      normalizeThaiText(input.facilityName) || null,
      input.machineName || null,
      input.appVersion || null,
      input.frontendVersion || null,
      input.dbStatus || "unknown"
    ]
  );

  const agent = await findAgentByUid(input.agentUid);
  if (!agent) {
    throw new Error("Agent not found after register");
  }

  const issuedKey = await issueAgentKey(agent.id, "register");
  return {
    affectedRows: result.affectedRows,
    agent: await getAgent(agent.id),
    apiKey: issuedKey.apiKey,
    apiKeyPrefix: issuedKey.apiKeyPrefix
  };
}

export async function heartbeat(input: HeartbeatInput) {
  await updateAgentProfile(input);
  const agent = await findAgentByUid(input.agentUid);
  if (!agent) {
    throw new Error("Agent not found after register");
  }

  await pool.query(
    `INSERT INTO agent_heartbeats (agent_id, status, db_status, app_version, frontend_version, payload)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      agent.id,
      input.status || "online",
      input.dbStatus || "unknown",
      input.appVersion || null,
      input.frontendVersion || null,
      JSON.stringify(input.payload || {})
    ]
  );

  await pool.query(
    `UPDATE agents SET status = ?, db_status = ?, last_seen_at = NOW(),
      app_version = COALESCE(?, app_version),
      frontend_version = COALESCE(?, frontend_version)
    WHERE id = ?`,
    [input.status || "online", input.dbStatus || "unknown", input.appVersion || null, input.frontendVersion || null, agent.id]
  );

  return getAgent(agent.id);
}

export async function authenticateAgent(agentUid: string, apiKey: string) {
  if (!agentUid || !apiKey) return null;
  const agent = await findAgentByUid(agentUid);
  if (!agent) return null;

  const keyHash = hashAgentKey(apiKey);
  const [keys] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM agent_api_keys
    WHERE agent_id = ? AND key_hash = ? AND status = 'active'
    LIMIT 1`,
    [agent.id, keyHash]
  );
  const key = keys[0];
  if (!key) return null;

  await pool.query(
    `UPDATE agent_api_keys SET last_used_at = NOW() WHERE id = ?`,
    [key.id]
  );
  await pool.query(
    `UPDATE agents SET api_key_last_used_at = NOW(), api_key_status = 'active' WHERE id = ?`,
    [agent.id]
  );

  return agent;
}

export async function rotateAgentKey(agentId: number) {
  const [agents] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM agents WHERE id = ? LIMIT 1`,
    [agentId]
  );
  if (!agents[0]) {
    const error = new Error("ไม่พบ agent");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  return issueAgentKey(agentId, "rotate");
}

export async function revokeAgentKey(agentId: number) {
  const [agents] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM agents WHERE id = ? LIMIT 1`,
    [agentId]
  );
  if (!agents[0]) {
    const error = new Error("ไม่พบ agent");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  await pool.query(
    `UPDATE agent_api_keys SET status = 'revoked', revoked_at = NOW()
    WHERE agent_id = ? AND status = 'active'`,
    [agentId]
  );
  await pool.query(
    `UPDATE agents SET api_key_status = 'revoked', api_key_last_used_at = NULL WHERE id = ?`,
    [agentId]
  );

  return { agentId, apiKeyStatus: "revoked" };
}

export async function listAgentApiKeys(agentId: number) {
  const [agents] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM agents WHERE id = ? LIMIT 1`,
    [agentId]
  );
  if (!agents[0]) {
    const error = new Error("ไม่พบ agent");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, key_prefix AS keyPrefix, status, created_at AS createdAt,
      revoked_at AS revokedAt, last_used_at AS lastUsedAt
    FROM agent_api_keys
    WHERE agent_id = ?
    ORDER BY id DESC`,
    [agentId]
  );
  return rows;
}

export async function listAgentEvents(agentId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, event_type AS eventType, severity, message, payload, created_at AS createdAt
    FROM agent_events
    WHERE agent_id = ?
    ORDER BY created_at DESC
    LIMIT 200`,
    [agentId]
  );
  return rows;
}

async function updateAgentProfile(input: RegisterAgentInput) {
  await pool.query<ResultSetHeader>(
    `INSERT INTO agents
      (agent_uid, facility_code, facility_name, machine_name, app_version, frontend_version, db_status, status, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'online', NOW())
    ON DUPLICATE KEY UPDATE
      facility_code = VALUES(facility_code),
      facility_name = VALUES(facility_name),
      machine_name = VALUES(machine_name),
      app_version = VALUES(app_version),
      frontend_version = VALUES(frontend_version),
      db_status = VALUES(db_status),
      status = 'online',
      last_seen_at = NOW()`,
    [
      input.agentUid,
      input.facilityCode || null,
      normalizeThaiText(input.facilityName) || null,
      input.machineName || null,
      input.appVersion || null,
      input.frontendVersion || null,
      input.dbStatus || "unknown"
    ]
  );
}

async function issueAgentKey(agentId: number, reason: "register" | "rotate") {
  await pool.query(
    `UPDATE agent_api_keys SET status = 'revoked', revoked_at = NOW()
    WHERE agent_id = ? AND status = 'active'`,
    [agentId]
  );
  const apiKey = generateAgentApiKey();
  const apiKeyPrefix = keyPrefix(apiKey);
  await pool.query(
    `INSERT INTO agent_api_keys (agent_id, key_hash, key_prefix, status)
    VALUES (?, ?, ?, 'active')`,
    [agentId, hashAgentKey(apiKey), apiKeyPrefix]
  );
  await pool.query(
    `UPDATE agents SET api_key_status = 'active', api_key_prefix = ?, api_key_last_used_at = NULL WHERE id = ?`,
    [apiKeyPrefix, agentId]
  );
  await pool.query(
    `INSERT INTO agent_events (agent_id, event_type, severity, message, payload)
    VALUES (?, 'api_key_issued', 'info', ?, ?)`,
    [
      agentId,
      reason === "register" ? "ออก Agent API Key จากการลงทะเบียน Agent" : "ออก Agent API Key ใหม่จาก Control",
      JSON.stringify({ reason, apiKeyPrefix })
    ]
  );
  return { agentId, apiKey, apiKeyPrefix };
}

async function findAgentByUid(agentUid: string): Promise<AgentIdentity | null> {
  const [rows] = await pool.query<AgentIdentity[]>(
    `SELECT id, agent_uid AS agentUid, api_key_status AS apiKeyStatus,
      api_key_prefix AS apiKeyPrefix
    FROM agents WHERE agent_uid = ?`,
    [agentUid]
  );
  return rows[0] || null;
}
