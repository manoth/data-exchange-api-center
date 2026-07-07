import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  AUTH_SECRET: z.string().min(32).optional(),
  AGENT_ENROLLMENT_TOKEN: z.string().min(32).optional(),
  AGENT_ONLINE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),
  CORS_ORIGIN: z.string().default("http://127.0.0.1:4200,http://localhost:4200")
});

const parsedEnv = envSchema.parse(process.env);

if (parsedEnv.NODE_ENV === "production") {
  if (!parsedEnv.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required in production.");
  }

  if (!parsedEnv.AGENT_ENROLLMENT_TOKEN) {
    throw new Error("AGENT_ENROLLMENT_TOKEN is required in production.");
  }
}

export const env = {
  ...parsedEnv,
  AUTH_SECRET: parsedEnv.AUTH_SECRET ?? "dev-only-auth-secret-change-before-production",
  AGENT_ENROLLMENT_TOKEN: parsedEnv.AGENT_ENROLLMENT_TOKEN ?? "dev-only-agent-enrollment-token-change"
};

export const corsOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
