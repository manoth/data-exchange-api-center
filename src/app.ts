import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { corsOrigins } from "./config/env.js";
import { requireAuth } from "./middlewares/auth.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { agentsRouter } from "./routes/agents.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { commandsRouter } from "./routes/commands.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { deathPersonsRouter } from "./routes/death-persons.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { updatesRouter } from "./routes/updates.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error("CORS origin not allowed"));
    }
  }));

  app.get("/", (_req, res) => {
    res.json({ ok: true, data: { service: "Data Exchange Tools API", version: "0.1.0" } });
  });

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", requireAuth, dashboardRouter);
  app.use("/api/agents", agentsRouter);
  app.use("/api/commands", requireAuth, commandsRouter);
  app.use("/api/death-persons", requireAuth, deathPersonsRouter);
  app.use("/api/updates", requireAuth, updatesRouter);

  app.use(errorHandler);

  return app;
}
