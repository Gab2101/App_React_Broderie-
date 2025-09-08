// src/Pages/Admin/Commandes/utils/labels.js
import { normalizeOne } from "../../../../utils/nettoyageRules";

// Déduplication en préservant l'ordre
const uniquePreserveOrder = (arr) => {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const key = String(v);
    if (!seen.has(key)) { seen.add(key); out.push(v); }
  }
  return out;
};

// Parse tolérant pour JSON array (gère espaces / quotes simples)
const tryParseJsonArray = (s) => {
  const t = s.trim();
  if (!t.startsWith("[") || !t.endsWith("]")) return null;
  try {
    return JSON.parse(t);
  } catch {
    // tentative avec quotes simples -> doubles
    try { return JSON.parse(t.replace(/'/g, '"')); } catch { return null; }
  }
};

// Parse simple de format Postgres array: {a,b,"c d"}
const tryParsePostgresArray = (s) => {
  const t = s.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return null;
  const inner = t.slice(1, -1);

  const items = [];
  let buf = "", inQuotes = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"' && inner[i - 1] !== "\\") { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { items.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf !== "") items.push(buf);

  return items.map((v) => v.replace(/\\"/g, '"').replace(/^"(.*)"$/, "$1"));
};

export const toLabelArray = (raw) => {
  if (raw == null) return [];
  try {
    // 1) Déjà un tableau
    if (Array.isArray(raw)) {
      return uniquePreserveOrder(
        raw.map((x) => normalizeOne?.(x)).filter(Boolean)
      );
    }

    // 2) Chaîne
    if (typeof raw === "string") {
      const s = raw.trim();

      // 2a) JSON array
      const jsonArr = tryParseJsonArray(s);
      if (Array.isArray(jsonArr)) {
        return uniquePreserveOrder(
          jsonArr.map((x) => normalizeOne?.(x)).filter(Boolean)
        );
      }

      // 2b) Postgres array {a,b,"c d"}
      const pgArr = tryParsePostgresArray(s);
      if (Array.isArray(pgArr)) {
        return uniquePreserveOrder(
          pgArr.map((x) => normalizeOne?.(x)).filter(Boolean)
        );
      }

      // 2c) CSV basique (support "," et ";")
      return uniquePreserveOrder(
        s.split(/[;,]/).map((x) => normalizeOne?.(x)).filter(Boolean)
      );
    }

    // 3) Fallback: valeur unique
    const one = normalizeOne?.(raw);
    return one ? [one] : [];
  } catch {
    return [];
  }
};
