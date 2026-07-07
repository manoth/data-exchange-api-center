import { Router } from "express";
import { getDashboardSummary } from "../services/dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", async (_req, res, next) => {
  try {
    res.json({ ok: true, data: await getDashboardSummary() });
  } catch (error) {
    next(error);
  }
});
