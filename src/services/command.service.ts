import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool.js";

export async function listCommands(agentId?: number) {
  const params: unknown[] = [];
  const where = agentId ? "WHERE c.agent_id = ?" : "";
  if (agentId) params.push(agentId);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.agent_id AS agentId, a.agent_uid AS agentUid,
      c.command_type AS commandType, c.payload, c.status, c.result,
      c.requested_by AS requestedBy, c.created_at AS createdAt,
      c.picked_at AS pickedAt, c.finished_at AS finishedAt
    FROM agent_commands c
    INNER JOIN agents a ON a.id = c.agent_id
    ${where}
    ORDER BY c.created_at DESC
    LIMIT 300`,
    params
  );

  return rows;
}

export async function createCommand(agentId: number, commandType: string, payload: unknown, requestedBy = "dashboard") {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO agent_commands (agent_id, command_type, payload, requested_by)
    VALUES (?, ?, ?, ?)`,
    [agentId, commandType, JSON.stringify(payload || {}), requestedBy]
  );

  return { id: result.insertId, agentId, commandType, status: "pending" };
}

export async function pullPendingCommands(agentUid: string) {
  const [agents] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM agents WHERE agent_uid = ?`,
    [agentUid]
  );
  const agent = agents[0];
  if (!agent) return [];

  const [commands] = await pool.query<RowDataPacket[]>(
    `SELECT id, command_type AS commandType, payload, status, created_at AS createdAt
    FROM agent_commands
    WHERE agent_id = ? AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT 20`,
    [agent.id]
  );

  if (commands.length) {
    await pool.query(
      `UPDATE agent_commands SET status = 'running', picked_at = NOW()
      WHERE id IN (${commands.map(() => "?").join(",")})`,
      commands.map((command) => command.id)
    );
  }

  return commands;
}

export async function finishCommand(commandId: number, status: "success" | "failed", result: unknown, agentId?: number) {
  const params: unknown[] = [status, JSON.stringify(result || {}), commandId];
  let agentClause = "";
  if (agentId) {
    agentClause = " AND agent_id = ?";
    params.push(agentId);
  }

  const [updateResult] = await pool.query<ResultSetHeader>(
    `UPDATE agent_commands SET status = ?, result = ?, finished_at = NOW()
    WHERE id = ?${agentClause}`,
    params
  );
  if (agentId && updateResult.affectedRows === 0) {
    const error = new Error("ไม่พบคำสั่งของ agent นี้");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  return { id: commandId, status };
}
