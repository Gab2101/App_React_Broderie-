// src/lib/occupancy.js

/**
 * Projection Commandes -> Blocs horaires visibles (sans fantômes)
 * - Granularité : 60 minutes
 * - Règle "Terminée" : libération à l'heure pleine suivante
 *   * t_free = ceilToHour(realEnd || end || now)
 *   * visibleEnd = min(end, t_free)
 *   * Si t_free === end → le dernier slot reste affiché jusqu’à end (pas de "grignotage" en minutes)
 * - Option de résolution de collisions par machine (priorité)
 */

import {
  toDate,
  floorToHour,
  ceilToHour,
  ONE_HOUR_MS,
  WORKDAY,
  isWorkHour,
} from "../utils/time";

/* =========================
 * Types de données attendus
 * =========================
 * Commande (exemple) :
 * {
 *   id: string|number,
 *   machineId: string|number,
 *   start: Date|string|number,      // début théorique (ou planifié)
 *   end: Date|string|number,        // fin théorique (ou recalculée)
 *   realEnd?: Date|string|number,   // horodatage de validation si "Terminée"
 *   statut: "A commencer" | "En cours" | "Terminée" | ...,
 *   priority?: number,              // optionnel (si tu as une logique de tri)
 *   ...autres champs
 * }
 *
 * Bloc horaire retourné :
 * {
 *   key: string,                    // clé stable pour le rendu
 *   commandeId: string|number,
 *   machineId: string|number,
 *   statut: string,
 *   slotStart: Date,
 *   slotEnd: Date,                  // = slotStart + 1h
 *   // optionnel : tu peux y remettre des infos utiles au hover/modal :
 *   start: Date,                    // début visible global de la commande
 *   end: Date,                      // fin visible globale de la commande
 *   meta: any                       // copie de champs utiles de la commande
 * }
 */

/** Utilitaire : itère heure par heure sur [start, end[ (end exclu) */
function* hourSlotsBetween(startDate, endDate) {
  let cur = floorToHour(startDate);
  const end = ceilToHour(endDate);
  while (cur < end) {
    const next = new Date(cur.getTime() + ONE_HOUR_MS);
    yield [cur, next];
    cur = next;
  }
}

/** Applique la règle “libérer à l’heure pleine” pour une commande */
function computeVisibleWindowForCommande(cmd, now = new Date()) {
  const start = toDate(cmd.start);
  const end = toDate(cmd.end);

  if (!(start instanceof Date) || isNaN(start)) return null;
  if (!(end instanceof Date) || isNaN(end)) return null;
  if (end <= start) return null; // rien à afficher

  // Base visible
  let visibleStart = floorToHour(start);
  let visibleEnd = end;

  if (String(cmd.statut).toLowerCase() === "terminée") {
    // Si realEnd existe, on s’en sert. Sinon on se rabat sur end (ou now en ultime recours)
    const tRaw = cmd.realEnd ?? end ?? now;
    const t = toDate(tRaw);
    const t_free = ceilToHour(t);   // heure pleine suivante
    // On ne montre rien après t_free
    if (t_free < visibleEnd) {
      visibleEnd = t_free;
    }
  }

  // Si l’arrondi annule l’intervalle
  if (visibleEnd <= visibleStart) return null;

  return { visibleStart, visibleEnd };
}

/** Construit les blocs horaires d’une commande (par pas de 1h) */
function buildBlocksForCommande(cmd, visibleStart, visibleEnd) {
  const machineId = cmd.machineId ?? cmd.machine_id ?? cmd.machine ?? "unknown";
  const res = [];
  for (const [slotStart, slotEnd] of hourSlotsBetween(visibleStart, visibleEnd)) {
    res.push({
      key: `${cmd.id}|${+slotStart}|${+slotEnd}|${cmd.statut}|${cmd.realEnd ?? ""}`,
      commandeId: cmd.id,
      machineId,
      statut: cmd.statut,
      slotStart,
      slotEnd,
      start: visibleStart,
      end: visibleEnd,
      meta: cmd, // pratique pour les tooltips/modals
    });
  }
  return res;
}

/**
 * (Optionnel) Filtrer les blocs en dehors des heures ouvrées,
 * si ta grille ne rend que 8–12 & 13–17.
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
      // Garde le meilleur selon comparator
      map.set(key, comparator(existing, b) <= 0 ? b : existing);
    }
  }
  return Array.from(map.values());
}

/**
 * Comparator par défaut (si tu as une logique de priorité, adapte ici).
 * Exemples de critères possibles :
 *  - statut: En cours > A commencer > Terminée (mais normalement Terminée ne devrait plus occuper)
 *  - deadline proche
 *  - cmd.priority (nombre inverse)
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
 *
 * @param {Array} commandes - liste de commandes
 * @param {Object} options
 *   - now: Date pour les décisions “à l’instant T” (défaut: new Date())
 *   - onlyWorkHours: boolean -> filtrer hors 8–12 / 13–17
 *   - resolveByPriority: boolean -> activer la résolution de collisions
 *   - comparator: function(a,b) -> si tu veux une stratégie custom
 *
 * @returns {Array} blocks - blocs horaires propres
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
 * Petit helper utile si tu veux la fenêtre visible brute (sans expansion en slots)
 * pour un affichage "barre unique par commande".
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
