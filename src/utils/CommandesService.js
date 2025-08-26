import { supabase } from "../supabaseClient";

/**
 * Calcule la durée réelle (en minutes, arrondie au supérieur)
 * entre deux timestamptz.
 */
const minutesBetween = (startISO, endISO) => {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 60000);
};

/**
 * Récupère l'état courant d'une commande (pour préserver started_at, etc.)
 */
const fetchCommandeCore = async (id) => {
  const { data, error } = await supabase
    .from("commandes")
    .select("id, statut, started_at, finished_at, broderie_minutes_reel")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
};

/**
 * Met à jour le statut avec gestion AUTOMATIQUE et SÛRE de:
 *  - started_at (pose si on passe en "En cours" et qu'il est vide)
 *  - finished_at (pose si on passe en "Terminée")
 *  - broderie_minutes_reel (calculée au passage en "Terminée" si started_at existe)
 *
 * IMPORTANT:
 *  - On NE touche JAMAIS à started_at s'il existe déjà (pas d'effacement).
 *  - On écrit started_at / finished_at en UTC (timestamptz) via toISOString().
 *
 * Usage côté UI (inchangé) :
 *   await updateCommandeStatut(commande.id, "En cours");
 *   await updateCommandeStatut(commande.id, "Terminée");
 */
export async function updateCommandeStatut(id, nextStatut) {
  if (id == null) throw new Error("id manquant");

  // Lire l'état courant pour préserver les timestamps existants
  const current = await fetchCommandeCore(id);

  const now = new Date();
  const patch = { statut: nextStatut };

  if (nextStatut === "En cours") {
    // Démarrage: ne poser started_at que s'il est vide
    if (!current?.started_at) {
      patch.started_at = now.toISOString(); // timestamptz → OK en UTC
    }
    // On ne modifie pas finished_at ici (si tu veux "reprendre" on peut le remettre à NULL)
    // patch.finished_at = null;
  } else if (nextStatut === "Terminée") {
    // Clôture: poser finished_at (même si déjà présent, on le remet à now)
    patch.finished_at = now.toISOString();

    // Calculer les minutes réelles si un démarrage existe
    if (current?.started_at) {
      patch.broderie_minutes_reel = minutesBetween(current.started_at, patch.finished_at);
    }
  }
  // Autres statuts: on ne touche à rien d'autre.

  const { data, error } = await supabase
    .from("commandes")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Version rétrocompatible si certains appels te passent l'objet commande complet.
 * Elle délègue à updateCommandeStatut(id, statut) pour garder une logique unique.
 */
export async function updateCommandeStatutWithAutoTimes(commande, nextStatut) {
  if (!commande?.id) throw new Error("Commande invalide");
  return updateCommandeStatut(commande.id, nextStatut);
}

/** Remplace une commande dans un tableau (égalité d'id robuste) */
export function replaceCommandeInArray(list, updated) {
  const uid = String(updated.id);
  return list.map((c) => (String(c.id) === uid ? { ...c, ...updated } : c));
}
