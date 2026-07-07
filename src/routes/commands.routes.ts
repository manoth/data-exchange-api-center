import { Router } from "express";
import { listCommands } from "../services/command.service.js";

export const commandsRouter = Router();

commandsRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await listCommands() });
  } catch (error) {
    next(error);
  }
});
