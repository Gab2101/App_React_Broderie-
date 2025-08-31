// src/Pages/Admin/Commandes/services/commandesApi.js
import { supabase } from "../../../../supabaseClient";
import { toLabelArray } from "../utils/labels";
import { getNextFullHour, nextWorkStart, addWorkingHours } from "../../../../utils/time";
import { calculerDurees } from "../../../../utils/calculs";
import {
  computeNettoyageSecondsForOrder,
} from "../../../../utils/nettoyageRules";
import {
  getLinkedLastFinishAndMachineId,
  getMachineByName,
} from "../utils/linked";
import { roundMinutesTo5 } from "../utils/timeRealtime";

// CREATE commande + planning (logique de confirmCreation)
export async function createCommandeAndPlanning({
  formData,
  machine,
  coef,
  monoUnitsUsed = 1, // 👈 nouveau
  assignation,
  commandeDurations,
  planning,
  commandes,
  machines,
  nettoyageRules,
  articleTags,
  linked: { isLinked, linkedCommandeId, sameMachineAsLinked, startAfterLinked },
}) {
  const { id, ...formSansId } = formData;

  // Payload pour la commande principale (table commandes)
  const payload = {
    ...formSansId,
    machineAssignee: machine.nom,
    vitesseMoyenne: Number(formData.vitesseMoyenne || 680),
    ...commandeDurations, // durées pré-calculées depuis la modale
    statut: "A commencer",
    multi_machine: false, // mode mono-machine
    linked_commande_id: isLinked ? Number(linkedCommandeId) : null,
    same_machine_as_linked: Boolean(isLinked && sameMachineAsLinked),
    start_after_linked: Boolean(isLinked && startAfterLinked),
    mono_units_used: Math.max(1, Number(monoUnitsUsed || 1)),
  };

  // Transaction atomique : commande + assignation
  const { data: createdCmd, error: errorCmd } = await supabase
    .from("commandes")
    .insert([payload])
    .select()
    .single();

  if (errorCmd) {
    return { errorCmd, errorAssign: null };
  }

  // Insertion dans commandes_assignations avec rollback si échec
  const assignationPayload = {
    ...assignation,
    commande_id: createdCmd.id, // lier à la commande créée
  };

  const { error: errorAssign } = await supabase
    .from("commandes_assignations")
    .insert([assignationPayload]);

  if (errorAssign) {
    // Rollback : supprimer la commande créée
    await supabase.from("commandes").delete().eq("id", createdCmd.id);
    return { errorCmd: null, errorAssign };
  }

  return { errorCmd: null, errorAssign: null, createdCmd };
}

export async function updateCommande(formData) {
  const { error } = await supabase.from("commandes").update(formData).eq("id", formData.id);
  return { error };
}

export async function deleteCommandeWithPlanning(id) {
  try {
    const { data: planningServeur, error: errorPlanningSelect } = await supabase
      .from("planning")
      .select("*")
      .eq("commandeId", id);
    if (errorPlanningSelect) {
      console.error("Erreur récupération planning:", errorPlanningSelect);
    }

    if (Array.isArray(planningServeur)) {
      for (const p of planningServeur) {
        const { error: errorDeletePlanning } = await supabase.from("planning").delete().eq("id", p.id);
        if (errorDeletePlanning) console.error("Erreur suppression planning:", errorDeletePlanning);
      }
    } else {
      console.warn("planningServeur n'est pas un tableau :", planningServeur);
    }

    const { error: deleteError } = await supabase.from("commandes").delete().eq("id", id);
    if (deleteError) return { error: deleteError };

    return { error: null };
  } catch (err) {
    console.error("Erreur suppression:", err);
    return { error: err };
  }
}
