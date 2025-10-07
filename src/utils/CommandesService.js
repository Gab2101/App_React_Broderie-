// utils/CommandesService.js
import supabase from '@/lib/supabaseClient'

/** Diff minutes (arrondi au supérieur) entre deux ISO/timestamptz */
export const minutesBetween = (startISO, endISO) => {
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  const ms = e - s;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 60000);
};

/** Récupère les champs nécessaires pour préserver l’existant */
const fetchCommandeCore = async (id) => {
  const { data, error } = await supabase
    .from("commandes")
    .select("id, statut, started_at, finished_at, finished_at, broderie_minutes_reel")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
};

/**
 * Met à jour le statut d'une commande avec gestion AUTOMATIQUE des horodatages.
 *
 * Règles:
 * - On écrit toujours en UTC avec .toISOString() (timestamptz OK).
 * - "En cours" : pose started_at si absent. (ne l’écrase jamais s’il existe)
 * - "Terminée" : pose finished_at si absent ET fixe finished_at (si colonne présente).
 *                calcule broderie_minutes_reel si started_at existe.
 * - Autres statuts : ne touche pas aux timestamps.
 *
 * Options:
 * - allowResume (false) : si true et nextStatut === "En cours" alors on peut "reprendre"
 *   en annulant finished_at/realEnd (si tu as ce cas d’usage).
 */
export async function updateCommandeStatut(id, nextStatut, { allowResume = false } = {}) {
  try {
    if (id == null) throw new Error("id manquant");
    nextStatut = String(nextStatut || "").trim();

    // Normalize case for comparison (handle lowercase inputs)
    const normalized = nextStatut.toLowerCase();
    const VALID = ["A commencer", "En cours", "Terminée", "Terminee", "Annulé", "En attente"];
    const normalizedValid = VALID.map(s => s.toLowerCase());

    if (!normalizedValid.includes(normalized)) throw new Error("Statut invalide");

    // Convert back to proper case for database storage
    const PROPER_CASE_MAP = {
      "a commencer": "A commencer",
      "en cours": "En cours",
      "terminée": "Terminée",
      "terminé": "Terminée", // Handle both accents
      "terminer": "Terminée",
      "annulé": "Annulé",
      "en attente": "En attente"
    };

    nextStatut = PROPER_CASE_MAP[normalized] || VALID.find(v => v.toLowerCase() === normalized) || nextStatut;

    const current = await fetchCommandeCore(id);
    const now = new Date();
    const nowISO = now.toISOString();

    const patch = { statut: nextStatut };

    if (nextStatut === "En cours") {
      // Démarrage : ne pas écraser s'il existe déjà
      if (!current?.started_at) {
        patch.started_at = nowISO;
      }
      // Reprise éventuelle : on "dé-clôture"
      if (allowResume) {
        patch.finished_at = null;
        patch.finished_at = null;
      }
    }

    if (nextStatut === "Terminée" || nextStatut === "Terminee") {
      // Ne PAS écraser un finished_at déjà posé (conserve la vérité)
      const endedAtISO = current?.finished_at ?? nowISO;

      patch.finished_at = endedAtISO;
      patch.finished_at = endedAtISO;

      if (current?.started_at) {
        patch.broderie_minutes_reel = minutesBetween(current.started_at, endedAtISO);
      }
    }

    const { data, error } = await supabase
      .from("commandes")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('updateCommandeStatut error:', error);
    throw error;
  }
}

/** Variante rétro-compatible si on reçoit parfois l’objet commande entier */
export async function updateCommandeStatutWithAutoTimes(commande, nextStatut, opts) {
  try {
    console.log('[CommandesService] updateCommandeStatutWithAutoTimes called:', {
      commandeId: commande?.id,
      nextStatut,
      opts
    });

    if (!commande?.id) {
      throw new Error("Commande invalide - missing id");
    }

    if (!nextStatut) {
      throw new Error("Statut invalide - missing nextStatut");
    }

    const result = await updateCommandeStatut(commande.id, nextStatut, opts);
    console.log('[CommandesService] Update successful:', result?.id);
    return result;
  } catch (error) {
    console.error('[CommandesService] updateCommandeStatutWithAutoTimes error:', error, {
      commandeId: commande?.id,
      nextStatut
    });
    throw error;
  }
}

/** Remplace une commande dans un tableau (égalité d'id robuste) */
export function replaceCommandeInArray(list, updated) {
  const uid = String(updated.id);
  return list.map((c) => (String(c.id) === uid ? { ...c, ...updated } : c));
}
