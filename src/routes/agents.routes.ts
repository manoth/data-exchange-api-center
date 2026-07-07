import { Router } from "express";
import type { RequestHandler } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth } from "../middlewares/auth.js";
import {
  authenticateAgent,
  getAgent,
  heartbeat,
  listAgentEvents,
  listAgentApiKeys,
  listAgents,
  registerAgent,
  revokeAgentKey,
  rotateAgentKey
} from "../services/agent.service.js";
import { createCommand, finishCommand, listCommands, pullPendingCommands } from "../services/command.service.js";
import { lookupDeathPersonPids } from "../services/death-person.service.js";

export const agentsRouter = Router();

const registerSchema = z.object({
  agentUid: z.string().min(3),
  facilityCode: z.string().optional(),
  facilityName: z.string().optional(),
  machineName: z.string().optional(),
  appVersion: z.string().optional(),
  frontendVersion: z.string().optional(),
  dbStatus: z.enum(["unknown", "ok", "failed"]).optional()
});

const heartbeatSchema = registerSchema.extend({
  status: z.enum(["online", "offline"]).optional(),
  payload: z.unknown().optional()
});

const deathPersonLookupSchema = z.object({
  pids: z.array(z.string()).max(5000)
});

const requireAgentAuth: RequestHandler = async (req, _res, next) => {
  try {
    const agentUid = req.header("x-agent-uid") || "";
    const agentKey = req.header("x-agent-key") || "";
    const agent = await authenticateAgent(agentUid, agentKey);
    if (!agent) {
      const error = new Error("Agent API key ไม่ถูกต้องหรือยังไม่ได้ลงทะเบียน");
      (error as Error & { statusCode?: number }).statusCode = 401;
      throw error;
    }
    req.agent = agent;
    next();
  } catch (error) {
    next(error);
  }
};

agentsRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await listAgents() });
  } catch (error) {
    next(error);
  }
});

agentsRouter.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const agent = await getAgent(Number(req.params.id));
    if (!agent) return res.status(404).json({ ok: false, error: "ไม่พบ agent" });
    res.json({ ok: true, data: agent });
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/register", async (req, res, next) => {
  try {
    const enrollmentToken = req.header("x-agent-enrollment-token") || "";
    if (enrollmentToken !== env.AGENT_ENROLLMENT_TOKEN) {
      return res.status(401).json({ ok: false, error: "Enrollment token ไม่ถูกต้อง" });
    }
    res.json({ ok: true, data: await registerAgent(registerSchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/heartbeat", requireAgentAuth, async (req, res, next) => {
  try {
    const body = heartbeatSchema.parse(req.body);
    if (req.agent?.agentUid !== body.agentUid) {
      return res.status(403).json({ ok: false, error: "Agent UID ไม่ตรงกับ API key" });
    }
    res.json({ ok: true, data: await heartbeat(body) });
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/death-persons/lookup", requireAgentAuth, async (req, res, next) => {
  try {
    const body = deathPersonLookupSchema.parse(req.body);
    res.json({ ok: true, data: { matchedPids: await lookupDeathPersonPids(body.pids) } });
  } catch (error) {
    next(error);
  }
});

agentsRouter.get("/uid/:agentUid/commands/pull", requireAgentAuth, async (req, res, next) => {
  try {
    if (req.agent?.agentUid !== req.params.agentUid) {
      return res.status(403).json({ ok: false, error: "Agent UID ไม่ตรงกับ API key" });
    }
    res.json({ ok: true, data: await pullPendingCommands(req.params.agentUid) });
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/commands/:commandId/result", requireAgentAuth, async (req, res, next) => {
  try {
    const body = z.object({
      status: z.enum(["success", "failed"]),
      result: z.unknown().optional()
    }).parse(req.body);
    res.json({ ok: true, data: await finishCommand(Number(req.params.commandId), body.status, body.result, req.agent?.id) });
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/:id/api-key/rotate", requireAuth, async (req, res, next) => {
  try {
    res.json({ ok: true, data: await rotateAgentKey(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/:id/api-key/revoke", requireAuth, async (req, res, next) => {
  try {
    res.json({ ok: true, data: await revokeAgentKey(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

agentsRouter.get("/:id/api-keys", requireAuth, async (req, res, next) => {
  try {
    res.json({ ok: true, data: await listAgentApiKeys(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

agentsRouter.get("/:id/events", requireAuth, async (req, res, next) => {
  try {
    res.json({ ok: true, data: await listAgentEvents(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

agentsRouter.get("/:id/commands", requireAuth, async (req, res, next) => {
  try {
    res.json({ ok: true, data: await listCommands(Number(req.params.id)) });
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/:id/commands", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      commandType: z.string().min(2),
      payload: z.unknown().optional(),
      requestedBy: z.string().optional()
    }).parse(req.body);
    res.json({ ok: true, data: await createCommand(Number(req.params.id), body.commandType, body.payload, body.requestedBy) });
  } catch (error) {
    next(error);
  }
});
