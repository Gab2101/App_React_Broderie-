// src/Pages/Admin/Commandes/utils/labels.js
import { normalizeOne } from "../../../../utils/nettoyageRules";

export const toLabelArray = (raw) => {
  if (!raw) return [];
  try {
    if (Array.isArray(raw)) return raw.map(normalizeOne).filter(Boolean);
    if (typeof raw === "string") {
      const s = raw.trim();
      if (s.startsWith("[") && s.endsWith("]")) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(normalizeOne).filter(Boolean);
      }
      return s.split(",").map(normalizeOne).filter(Boolean);
    }
    return [normalizeOne(raw)].filter(Boolean);
  } catch {
    return [];
  }
};
