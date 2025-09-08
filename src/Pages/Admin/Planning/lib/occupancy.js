// src/lib/occupancy.js

/**
 * Projection Commandes -> Blocs horaires visibles (sans fantômes)
 * - Granularité : 60 minutes
 * - Règle "Terminée" : libération à l'heure pleine suivante PARIS
 *   * t_free = ceilHourWorkParis(finished_at || end || now)
 *   * visibleEnd = min(end, t_free)
 * - Option de résolution de collisions par machine (priorité)
 */

import { toDate, WORKDAY, isWorkHour } from "../utils/time";

/* =========================
 * Helpers Paris (locaux)
 * ========================= */
function floorToHourLocal(dLike) {
  const d = new Date(dLike);
  d.setMinutes(0, 0, 0);
  return d;
}
function clampToWorkdayParis(dLike) {
  const d = new Date(dLike);
  const day0 = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const setHM = (h, m = 0) =>
    new Date(day0.getFullYear(), day0.getMonth(), day0.getDate(), h, m, 0, 0);

  const t = d.getHours() + d.getMinutes() / 60;

  if (t < WORKDAY.start) return setHM(WORKDAY.start);
  if (t >= WORKDAY.lunchStart && t < WORKDAY.lunchEnd) return setHM(WORKDAY.lunchEnd);
  if (t >= WORKDAY.end) return setHM(WORKDAY.end);
  return d;
}
function ceilHourWorkParis(dLike) {
  const d = new Date(dLike);
  if (d.getMinutes() || d.getSeconds() || d.getMilliseconds()) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  } else {
    d.setMilliseconds(0);
  }
  return clampToWorkdayParis(d);
}

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Utilitaire : itère heure par heure sur [start, end[ (end exclu) */
function* hourSlotsBetween(startDate, endDate) {
  let cur = floorToHourLocal(startDate);
  const end = ceilHourWorkParis(endDate);
  while (cur < end) {
    const next = new Date(cur.getTime() + ONE_HOUR_MS);
    yield [cur, next];
    cur = next;
  }
}

/** Applique la règle “libérer à l’heure pleine (Paris)” pour une commande */
function computeVisibleWindowForCommande(cmd, now = new Date()) {
  const start = toDate(cmd.start);
  const end = toDate(cmd.end);

  if (!(start instanceof Date) || isNaN(start)) return null;
  if (!(end instanceof Date) || isNaN(end)) return null;
  if (end <= start) return null; // rien à afficher

  // Base visible (début arrondi à l'heure pleine inférieure)
  let visibleStart = floorToHourLocal(start);
  let visibleEnd = end;

  // Statut "Terminée" → couper à la prochaine heure pleine Paris (pause/fin jour respectées)
  if (String(cmd.statut).toLowerCase() === "terminée" || String(cmd.statut).toLowerCase() === "terminee") {
    const tRaw = cmd.finished_at ?? end ?? now;
    const tFree = ceilHourWorkParis(tRaw);
    if (tFree < visibleEnd) {
      visibleEnd = tFree;
    }
  }

  // Clamp sécurité (si la commande dépasse la journée en cours, on laisse tel quel ;
  // le filtrage 8–12/13–16 se fera plus bas si activé)
  if (visibleEnd <= visibleStart) return null;

  return { visibleStart, visibleEnd };
}

/** Construit les blocs horaires d’une commande (par pas de 1h) */
function buildBlocksForCommande(cmd, visibleStart, visibleEnd) {
  const machineId = cmd.machineId ?? cmd.machine_id ?? cmd.machine ?? "unknown";
  const res = [];
  for (const [slotStart, slotEnd] of hourSlotsBetween(visibleStart, visibleEnd)) {
    res.push({
      key: `${cmd.id}|${+slotStart}|${+slotEnd}|${cmd.statut}|${cmd.finished_at ?? ""}`,
      commandeId: cmd.id,
      machineId,
      statut: cmd.statut,
      slotStart,
      slotEnd,               // = slotStart + 1h
      start: visibleStart,   // fenêtre visible globale (pratique pour tooltip)
      end: visibleEnd,
      meta: cmd,
    });
  }
  return res;
}

/**
 * (Optionnel) Filtrer les blocs en dehors des heures ouvrées,
 * si ta grille ne rend que 8–12 & 13–16.
 */
function filterToWorkHours(blocks, { keepSlotIfTouches = false } = {}) {
  return blocks.filter((b) => {
    const h = b.slotStart.getHours();
    const inMorning = h >= WORKDAY.start && h < WORKDAY.lunchStart;
    const inAfternoon = h >= WORKDAY.lunchEnd && h < WORKDAY.end;
    if (inMorning || inAfternoon) return true;

    // Option pour conserver les slots “bordures” si besoin
    if (keepSlotIfTouches) {
      return isWorkHour(b.slotStart) || isWorkHour(new Date(b.slotEnd.getTime() - 1));
    }
    return false;
  });
}

/**
 * (Optionnel) Résolution de collisions par machine.
 * Stratégie simple : on regroupe par (machineId, slotStart) et on ne garde qu’un bloc selon un comparator.
 */
function resolveCollisions(blocks, comparator) {
  if (!comparator) return blocks;
  const map = new Map(); // key = machineId|slotStartMs -> bloc retenu
  for (const b of blocks) {
    const key = `${b.machineId}|${+b.slotStart}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, b);
    } else {
      // Garde le "meilleur" selon comparator
      map.set(key, comparator(existing, b) <= 0 ? b : existing);
    }
  }
  return Array.from(map.values());
}

/**
 * Comparator par défaut (si tu as une logique de priorité, adapte ici).
 */
function defaultComparator(a, b) {
  const rank = (s) => {
    const x = String(s || "").toLowerCase();
    if (x === "en cours") return 3;
    if (x === "a commencer" || x === "à commencer") return 2;
    if (x === "terminée" || x === "terminee") return 1;
    return 0;
  };
  const rA = rank(a.statut);
  const rB = rank(b.statut);
  if (rA !== rB) return rA - rB;

  // Si tu as un champ priorité numérique :
  const pA = Number(a.meta?.priority ?? a.meta?.priorite ?? 0);
  const pB = Number(b.meta?.priority ?? b.meta?.priorite ?? 0);
  if (pA !== pB) return pA - pB;

  // Dernier recours : id (stable)
  return String(a.commandeId).localeCompare(String(b.commandeId));
}

/**
 * API principale : calcule les blocs visibles à partir d’une liste de commandes.
 */
export function computeVisibleBlocks(commandes = [], options = {}) {
  const {
    now = new Date(),
    onlyWorkHours = false,
    resolveByPriority = false,
    comparator = defaultComparator,
  } = options;

  const blocks = [];

  for (const cmd of commandes || []) {
    const window = computeVisibleWindowForCommande(cmd, now);
    if (!window) continue;

    const { visibleStart, visibleEnd } = window;
    const cmdBlocks = buildBlocksForCommande(cmd, visibleStart, visibleEnd);
    blocks.push(...cmdBlocks);
  }

  let out = blocks;

  if (onlyWorkHours) {
    out = filterToWorkHours(out);
  }

  if (resolveByPriority) {
    out = resolveCollisions(out, comparator);
  }

  // Tri final pour un rendu stable : par machine, puis par heure
  out.sort((a, b) => {
    if (a.machineId !== b.machineId) {
      return String(a.machineId).localeCompare(String(b.machineId));
    }
    return a.slotStart - b.slotStart;
  });

  return out;
}

/**
 * Fenêtre visible brute par commande (sans expansion en slots).
 */
export function computeVisibleWindowByCommande(commandes = [], now = new Date()) {
  const res = [];
  for (const cmd of commandes || []) {
    const window = computeVisibleWindowForCommande(cmd, now);
    if (!window) continue;
    res.push({
      commandeId: cmd.id,
      machineId: cmd.machineId ?? cmd.machine_id ?? cmd.machine ?? "unknown",
      statut: cmd.statut,
      start: window.visibleStart,
      end: window.visibleEnd,
      meta: cmd,
    });
  }
  return res;
}
