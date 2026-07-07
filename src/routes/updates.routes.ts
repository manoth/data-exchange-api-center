import { Router } from "express";
import { getLatestVersion, listVersions } from "../services/update.service.js";

export const updatesRouter = Router();

updatesRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await listVersions() });
  } catch (error) {
    next(error);
  }
});

updatesRouter.get("/latest", async (req, res, next) => {
  try {
    const channel = typeof req.query.channel === "string" ? req.query.channel : "stable";
    res.json({ ok: true, data: await getLatestVersion(channel) });
  } catch (error) {
    next(error);
  }
});
