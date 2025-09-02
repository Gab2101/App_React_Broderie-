import { supabase } from "../supabaseClient";
import { ceilToHour, nextWorkStart, addWorkingHours, getWorkingMinutesBetween } from "./time";
import { DEFAULT_WORKDAY } from "../Pages/Admin/Commandes/utils/workhours";
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
 * Ajuste le planning d'une commande UNIQUEMENT lors du passage en "En cours"
 * Si le début planifié est dans le passé, le recale à ceilToHour(now)
 * Respecte les heures ouvrées et préserve la durée originale
 */
const adjustPlanningForEnCours = async (commandeId, now) => {
  try {
    // 1. Récupérer les entrées de planning pour cette commande
    const { data: planningEntries, error: planningError } = await supabase
      .from("planning")
      .select("id, debut, fin, commandeId, machineId")
      .eq("commandeId", commandeId);

    if (planningError) {
      console.error("❌ Erreur récupération planning pour commande", commandeId, ":", planningError);
      return;
    }

    if (!planningEntries || planningEntries.length === 0) {
      console.warn("Aucune entrée de planning trouvée pour la commande", commandeId);
      return;
    }

    // 2. Traiter chaque entrée de planning
    const updates = [];
    for (const entry of planningEntries) {
      const plannedStart = new Date(entry.debut);
      const plannedEnd = new Date(entry.fin);

      // RÈGLE : Si le début planifié est dans le passé, recaler à ceilToHour(now)
      if (plannedStart < now) {
        const newStart = ceilToHour(now);
        
        // Calculer la durée originale en minutes ouvrées
        const originalDuration = getWorkingMinutesBetween(plannedStart, plannedEnd, {
          skipNonBusiness: true,
          holidays: new Set()
        });

        // Ajuster le début aux heures ouvrées (respecte DEFAULT_WORKDAY)
        const adjustedStart = nextWorkStart(newStart, { 
          skipNonBusiness: true, 
          holidays: new Set() 
        });

        // Calculer la nouvelle fin en préservant la durée et respectant les heures ouvrées
        const adjustedEnd = addWorkingHours(adjustedStart, originalDuration / 60, {
          skipNonBusiness: true,
          holidays: new Set()
        });

        // Arrondir aux 5 minutes pour cohérence avec le système
        const roundedStart = roundToNearest5Minutes(adjustedStart);
        const roundedEnd = roundToNearest5Minutes(adjustedEnd);

        updates.push({
          id: entry.id,
          debut: roundedStart.toISOString(),
          fin: roundedEnd.toISOString()
        });

        console.log(`📅 Recalage commande ${commandeId}: ${plannedStart.toLocaleString()} → ${roundedStart.toLocaleString()}`);
      }
    }

    // 3. Appliquer les mises à jour si nécessaire
    if (updates.length > 0) {
      await Promise.all(
        updates.map(update => 
          supabase.from("planning").update({
            debut: update.debut,
            fin: update.fin
          }).eq("id", update.id)
        )
      );
      console.log(`✅ Planning recalé pour commande ${commandeId}: ${updates.length} entrée(s) mise(s) à jour`);
    }
  } catch (error) {
    console.error("❌ Erreur lors du recalage du planning:", error);
  }
};

/**
 * Met à jour le statut avec gestion AUTOMATIQUE et SÛRE de:
 *  - started_at (pose si on passe en "En cours" et qu'il est vide)
 *  - finished_at (pose si on passe en "Terminée")
 *  - broderie_minutes_reel (calculée au passage en "Terminée" si started_at existe)
 *  - Recalage du planning UNIQUEMENT lors du passage en "En cours"
 *
 * IMPORTANT:
 *  - On NE touche JAMAIS à started_at s'il existe déjà (pas d'effacement).
 *  - On écrit started_at / finished_at en UTC (timestamptz) via toISOString().
 *  - Si passage en "En cours", recaler le planning si le début est dans le passé.
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
    
    // RÈGLE FEATURE 2: Recaler le planning UNIQUEMENT lors du passage en "En cours"
    await adjustPlanningForEnCours(id, now);
    
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
