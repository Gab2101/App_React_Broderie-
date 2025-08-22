// src/utils/nettoyageRules.js
import { supabase } from "../supabaseClient";

/** Normalise un label en string lowercased/trimmed */
export function normalizeLabel(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim().toLowerCase();
  if (typeof v === "object") {
    const cand = v.label ?? v.name ?? v.value ?? "";
    return String(cand).trim().toLowerCase();
  }
  return String(v).trim().toLowerCase();
}
// alias pour compat
export const normalizeOne = normalizeLabel;

/** Récupère toutes les règles (article_label, broderie_label, nettoyage_sec, is_allowed) */
export async function fetchNettoyageRules() {
  const { data, error } = await supabase
    .from("nettoyage_rules")
    .select("*")
    .order("article_label", { ascending: true })
    .order("broderie_label", { ascending: true });

  if (error) {
    console.error("fetchNettoyageRules error:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

/** Upsert en masse (clé composite article_label,broderie_label) */
export async function upsertNettoyageRules(rows = []) {
  const clean = rows.map((r) => ({
    article_label: normalizeLabel(r.article_label),
    broderie_label: normalizeLabel(r.broderie_label),
    nettoyage_sec: Math.max(0, Math.round(Number(r.nettoyage_sec || 0))),
    is_allowed: Boolean(r.is_allowed),
  }));

  const { data, error } = await supabase
    .from("nettoyage_rules")
    .upsert(clean, { onConflict: "article_label,broderie_label" })
    .select();

  if (error) {
    console.error("upsertNettoyageRules error:", error.message);
    throw error;
  }
  return data ?? [];
}

/** Ensemble des zones autorisées pour un article donné */
export function getAllowedBroderieForArticle(rules, articleLabel) {
  const a = normalizeLabel(articleLabel);
  const set = new Set();
  (rules || []).forEach((r) => {
    if (normalizeLabel(r.article_label) === a && r.is_allowed) {
      set.add(normalizeLabel(r.broderie_label));
    }
  });
  return set;
}

/**
 * Calcule le temps de nettoyage par pièce (secondes) pour l’article + options sélectionnées.
 * - Somme les temps des zones autorisées trouvées dans `rules`.
 * - Fallback optionnel: si total=0 et que `articleTags` est fourni, utilise articleTag.nettoyage.
 */
export function computeNettoyageSecondsForOrder(
  articleLabel,
  selectedOptions,
  rules,
  articleTags /* optionnel */
) {
  const a = normalizeLabel(articleLabel);
  const times = new Map();
  (rules || []).forEach((r) => {
    if (normalizeLabel(r.article_label) === a && r.is_allowed) {
      times.set(normalizeLabel(r.broderie_label), Number(r.nettoyage_sec) || 0);
    }
  });

  let total = 0;
  const opts = Array.isArray(selectedOptions) ? selectedOptions : [];
  opts.forEach((opt) => {
    const key = normalizeLabel(opt);
    if (times.has(key)) total += times.get(key);
  });

  if (total === 0 && Array.isArray(articleTags)) {
    const fallback = articleTags.find(
      (t) => normalizeLabel(t.label) === a
    );
    return Number(fallback?.nettoyage || 0);
  }
  return total;
}
