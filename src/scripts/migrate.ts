import { pool } from "../db/pool.js";
import { schemaStatements } from "../db/schema.js";
import { ensureDefaultAdmin } from "../services/auth.service.js";

async function ensureColumn(table: string, column: string, definition: string) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?`,
    [table, column]
  );
  const count = Number((rows as Array<{ count: number }>)[0]?.count || 0);
  if (count === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

async function migrateExistingTables() {
  await ensureColumn("agents", "api_key_status", "api_key_status ENUM('none','active','revoked') NOT NULL DEFAULT 'none' AFTER status");
  await ensureColumn("agents", "api_key_prefix", "api_key_prefix VARCHAR(20) NULL AFTER api_key_status");
  await ensureColumn("agents", "api_key_last_used_at", "api_key_last_used_at DATETIME NULL AFTER api_key_prefix");
  await ensureColumn("agents", "is_primary_agent", "is_primary_agent TINYINT(1) NOT NULL DEFAULT 0 AFTER api_key_last_used_at");
}

async function migrate() {
  for (const statement of schemaStatements) {
    await pool.query(statement);
  }
  await migrateExistingTables();
  await ensureDefaultAdmin();

  await pool.end();
  console.log(`Migration completed: ${schemaStatements.length} tables checked, default admin ensured.`);
}

migrate().catch(async (error) => {
  console.error("Migration failed:", error);
  await pool.end();
  process.exit(1);
});
