import { supabase } from "../supabaseClient";

/**
 * Met à jour le statut d'une commande en gérant automatiquement:
 * - started_at lors du passage "A commencer" -> "En cours"
 * - finished_at lors du passage vers "Terminée"
 * Ne réécrit pas un champ déjà rempli.
 */
export async function updateCommandeStatutWithAutoTimes(commande, nextStatut) {
  if (!commande?.id) throw new Error("Commande invalide");

  const payload = { statut: nextStatut };
  const nowISO = new Date().toISOString();

  const prev = commande.statut || "A commencer";
  const wasNotStarted = !commande.started_at;
  const wasNotFinished = !commande.finished_at;

  // Début automatique
  if (
    nextStatut === "En cours" &&
    wasNotStarted &&                          // ne pas écraser s'il existe déjà
    (prev === "A commencer" || prev === "En pause")
  ) {
    payload.started_at = nowISO;
  }

  // Fin automatique
  if (nextStatut === "Terminée" && wasNotFinished) {
    payload.finished_at = nowISO;
  }

  const { data, error } = await supabase
    .from("commandes")
    .update(payload)
    .eq("id", commande.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** (conservé) mise à jour simple sans timestamps */
export async function updateCommandeStatut(id, statut) {
  const { data, error } = await supabase
    .from("commandes")
    .update({ statut })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Remplace une commande dans un tableau (égalité d'id robuste) */
export function replaceCommandeInArray(list, updated) {
  const uid = String(updated.id);
  return list.map((c) => (String(c.id) === uid ? { ...c, ...updated } : c));
}
