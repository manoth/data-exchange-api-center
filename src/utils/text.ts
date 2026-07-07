import iconv from "iconv-lite";

const THAI_MOJIBAKE_PATTERN = /เธ|เน|โ€|à¸|à¹|\uFFFD/;
const THAI_PATTERN = /[\u0E00-\u0E7F]/;

function markerCount(value: string) {
  return (value.match(/เธ|เน|โ€|à¸|à¹|\uFFFD/g) || []).length;
}

function looksLikeThaiMojibake(value: string) {
  return THAI_MOJIBAKE_PATTERN.test(value);
}

function isBetterThaiText(original: string, candidate: string) {
  if (!candidate || candidate === original) return false;
  if (!THAI_PATTERN.test(candidate)) return false;
  return markerCount(candidate) < markerCount(original);
}

export function normalizeThaiText(value?: string | null) {
  if (value === undefined || value === null) return value ?? null;

  const text = String(value).trim();
  if (!text || !looksLikeThaiMojibake(text)) return text;

  const candidates = ["windows-874", "tis620"].flatMap((encoding) => {
    try {
      return [iconv.decode(iconv.encode(text, encoding), "utf8").trim()];
    } catch {
      return [];
    }
  });

  return candidates.find((candidate) => isBetterThaiText(text, candidate)) || text;
}

export function normalizeAgentRow<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    facilityName: normalizeThaiText(row.facilityName as string | null | undefined)
  };
}
