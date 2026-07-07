import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const statusCode = Number(error?.statusCode || error?.status || 500);
  const message = statusCode >= 500 ? "เกิดข้อผิดพลาดภายในระบบ" : String(error?.message || "คำขอไม่ถูกต้อง");

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    ok: false,
    error: message
  });
};
