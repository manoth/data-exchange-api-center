import { ResultSetHeader, RowDataPacket } from "mysql2";
import * as XLSX from "xlsx";
import { pool } from "../db/pool.js";

export type DeathPersonImportSummary = {
  importId: number;
  fileName: string;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  importedBy?: string | null;
  createdAt: string;
};

type DeathPersonRow = {
  pid: string;
  sex: string | null;
  age: number | null;
  deathDate: string | null;
  deathYear: number | null;
  deathCauseCode: string | null;
  rawData: Record<string, unknown>;
};

const BATCH_SIZE = 500;

export async function importDeathPersonsFromExcel(file: Express.Multer.File, importedBy?: string | null) {
  if (!file?.buffer?.length) {
    const error = new Error("กรุณาเลือกไฟล์ Excel ก่อนนำเข้า");
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }

  const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    const error = new Error("ไม่พบ worksheet ในไฟล์ Excel");
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false
  });

  const preparedRows: DeathPersonRow[] = [];
  let skippedRows = 0;
  const seenInFile = new Set<string>();

  for (const row of rows) {
    const normalized = normalizeRow(row);
    const pid = personKeyValue(normalized.PID);
    if (!pid) {
      skippedRows += 1;
      continue;
    }

    if (seenInFile.has(pid)) {
      const index = preparedRows.findIndex((item) => item.pid === pid);
      if (index >= 0) preparedRows.splice(index, 1);
    }
    seenInFile.add(pid);

    const deathYear = numberValue(normalized.DYEAR);
    preparedRows.push({
      pid,
      sex: textValue(normalized.SEX) || null,
      age: numberValue(normalized.AGE),
      deathDate: thaiDateValue(normalized.DDATE, normalized.DMON, normalized.DYEAR),
      deathYear,
      deathCauseCode: textValue(normalized.NCAUSE) || null,
      rawData: normalized
    });
  }

  const existingPids = await findExistingPids(preparedRows.map((row) => row.pid));
  const insertedRows = preparedRows.filter((row) => !existingPids.has(row.pid)).length;
  const updatedRows = preparedRows.length - insertedRows;

  for (let index = 0; index < preparedRows.length; index += BATCH_SIZE) {
    await upsertDeathPersonRows(preparedRows.slice(index, index + BATCH_SIZE), file.originalname, importedBy || null);
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO death_person_imports
      (file_name, total_rows, inserted_rows, updated_rows, skipped_rows, imported_by)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [file.originalname, rows.length, insertedRows, updatedRows, skippedRows, importedBy || null]
  );

  const importId = Number(result.insertId);
  return getDeathPersonImport(importId);
}

export async function listDeathPersonImports() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, file_name AS fileName, total_rows AS totalRows,
      inserted_rows AS insertedRows, updated_rows AS updatedRows, skipped_rows AS skippedRows,
      imported_by AS importedBy, created_at AS createdAt
    FROM death_person_imports
    ORDER BY created_at DESC
    LIMIT 100`
  );
  return rows;
}

export async function getDeathPersonSummary() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS totalRows, MAX(updated_at) AS latestUpdatedAt
    FROM death_persons`
  );
  return rows[0] || { totalRows: 0, latestUpdatedAt: null };
}

export async function lookupDeathPersonPids(pids: string[]) {
  const normalizedPids = Array.from(
    new Set(
      pids
        .map((pid) => personKeyValue(pid))
        .filter((pid) => pid.length > 0)
    )
  );
  if (!normalizedPids.length) return [];

  return Array.from(await findExistingPids(normalizedPids));
}

async function getDeathPersonImport(importId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, file_name AS fileName, total_rows AS totalRows,
      inserted_rows AS insertedRows, updated_rows AS updatedRows, skipped_rows AS skippedRows,
      imported_by AS importedBy, created_at AS createdAt
    FROM death_person_imports
    WHERE id = ?`,
    [importId]
  );
  return rows[0] || null;
}

async function findExistingPids(pids: string[]) {
  const existing = new Set<string>();
  for (let index = 0; index < pids.length; index += BATCH_SIZE) {
    const chunk = pids.slice(index, index + BATCH_SIZE);
    if (!chunk.length) continue;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT pid FROM death_persons WHERE pid IN (${chunk.map(() => "?").join(",")})`,
      chunk
    );
    rows.forEach((row) => existing.add(String(row.pid)));
  }
  return existing;
}

async function upsertDeathPersonRows(rows: DeathPersonRow[], fileName: string, importedBy: string | null) {
  if (!rows.length) return;

  const placeholders = rows.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",");
  const values = rows.flatMap((row) => [
    row.pid,
    row.sex,
    row.age,
    row.deathDate,
    row.deathYear,
    row.deathCauseCode,
    JSON.stringify(row.rawData),
    fileName,
    importedBy
  ]);

  await pool.query(
    `INSERT INTO death_persons
      (pid, sex, age, death_date, death_year, death_cause_code, raw_data, source_file, imported_by)
    VALUES ${placeholders}
    ON DUPLICATE KEY UPDATE
      sex = VALUES(sex),
      age = VALUES(age),
      death_date = VALUES(death_date),
      death_year = VALUES(death_year),
      death_cause_code = VALUES(death_cause_code),
      raw_data = VALUES(raw_data),
      source_file = VALUES(source_file),
      imported_by = VALUES(imported_by)`,
    values
  );
}

function normalizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim().toUpperCase(), value])
  ) as Record<string, unknown>;
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function personKeyValue(value: unknown) {
  const text = textValue(value);
  if (!text) return "";

  let normalized = text;
  if (normalized.endsWith(".0") && /^\d+\.0$/.test(normalized)) {
    normalized = normalized.slice(0, -2);
  }

  const digits = normalized.replace(/\D/g, "");
  if (!digits) return normalized;

  // Excel sometimes drops the leading zero for 13-digit identifiers.
  if (digits.length === 12) return digits.padStart(13, "0");
  return digits;
}

function numberValue(value: unknown) {
  const text = textValue(value).replace(/,/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function thaiDateValue(dayValue: unknown, monthValue: unknown, yearValue: unknown) {
  const day = numberValue(dayValue);
  const month = numberValue(monthValue);
  const rawYear = numberValue(yearValue);
  if (!day || !month || !rawYear) return null;

  const year = rawYear > 2400 ? rawYear - 543 : rawYear;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}
