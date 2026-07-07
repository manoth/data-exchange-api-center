import { Router } from "express";
import { pingDatabase } from "../db/pool.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res, next) => {
  try {
    await pingDatabase();
    res.json({
      ok: true,
      data: {
        service: "data-exchange-tools-api",
        version: "0.1.0",
        database: "ok",
        time: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});
