import crypto from "crypto";
import type { RowDataPacket } from "mysql2";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

const HASH_ITERATIONS = 260000;
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = "sha256";

export type AuthUser = {
  id: number;
  username: string;
  displayName: string | null;
  role: "admin" | "operator";
};

type UserRow = RowDataPacket & AuthUser & {
  passwordHash: string;
  isActive: number;
};

function base64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST);
  return `pbkdf2_${HASH_DIGEST}$${HASH_ITERATIONS}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterationsText, saltText, hashText] = storedHash.split("$");
  if (algorithm !== `pbkdf2_${HASH_DIGEST}` || !iterationsText || !saltText || !hashText) return false;

  const iterations = Number(iterationsText);
  const salt = Buffer.from(saltText, "base64url");
  const expectedHash = Buffer.from(hashText, "base64url");
  const actualHash = crypto.pbkdf2Sync(password, salt, iterations, expectedHash.length, HASH_DIGEST);
  return crypto.timingSafeEqual(expectedHash, actualHash);
}

export async function ensureDefaultAdmin() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM users WHERE username = ? LIMIT 1`,
    ["admin"]
  );
  if (rows.length > 0) return;

  await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role, is_active)
    VALUES (?, ?, ?, 'admin', 1)`,
    ["admin", hashPassword("admin"), "System Administrator"]
  );
}

export async function login(username: string, password: string) {
  const [rows] = await pool.query<UserRow[]>(
    `SELECT id, username, password_hash AS passwordHash, display_name AS displayName, role, is_active AS isActive
    FROM users
    WHERE username = ?
    LIMIT 1`,
    [username]
  );

  const user = rows[0];
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    const error = new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }

  const authUser: AuthUser = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role
  };

  return {
    token: signToken(authUser),
    user: authUser
  };
}

export function signToken(user: AuthUser) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8
  }));
  const signature = crypto.createHmac("sha256", env.AUTH_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): AuthUser {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throwUnauthorized();

  const expectedSignature = crypto.createHmac("sha256", env.AUTH_SECRET).update(`${header}.${payload}`).digest("base64url");
  if (signature.length !== expectedSignature.length) throwUnauthorized();
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) throwUnauthorized();

  let parsed: {
    sub: number;
    username: string;
    displayName: string | null;
    role: "admin" | "operator";
    exp: number;
  };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throwUnauthorized();
  }
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) throwUnauthorized();

  return {
    id: parsed.sub,
    username: parsed.username,
    displayName: parsed.displayName,
    role: parsed.role
  };
}

function throwUnauthorized(): never {
  const error = new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน");
  (error as Error & { statusCode?: number }).statusCode = 401;
  throw error;
}
