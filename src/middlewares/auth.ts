import type { RequestHandler } from "express";
import { verifyToken, type AuthUser } from "../services/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      agent?: {
        id: number;
        agentUid: string;
        apiKeyStatus: "none" | "active" | "revoked";
      };
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  try {
    const authorization = req.header("authorization") || "";
    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
      const error = new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
      (error as Error & { statusCode?: number }).statusCode = 401;
      throw error;
    }

    req.user = verifyToken(token);
    next();
  } catch (error) {
    next(error);
  }
};
