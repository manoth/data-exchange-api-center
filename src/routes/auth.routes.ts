import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.js";
import { login } from "../services/auth.service.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = z.object({
      username: z.string().min(1),
      password: z.string().min(1)
    }).parse(req.body);

    res.json({ ok: true, data: await login(body.username, body.password) });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, data: req.user });
});
