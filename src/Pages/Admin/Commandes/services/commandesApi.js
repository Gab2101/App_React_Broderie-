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

// CREATE commande + assignation (flux MONO)
export async function createCommandeAndPlanning({
  formData,
  machine,
  coef,
  monoUnitsUsed = 1,
  assignation, // ⬅️ DOIT être passé depuis MachineAndTimeConfirmModal
  commandeDurations,
  planning,
  commandes,
  machines,
  nettoyageRules,
  articleTags,
  linked: { isLinked, linkedCommandeId, sameMachineAsLinked, startAfterLinked },
}) {
  const { id, ...formSansId } = formData;

  // 1) insert commande
  const payload = {
    ...formSansId,
    machineAssignee: machine?.nom ?? null,
    vitesseMoyenne: Number(formData.vitesseMoyenne || 680),
    ...commandeDurations,
    statut: "A commencer",
    multi_machine: false,
    linked_commande_id: isLinked ? Number(linkedCommandeId) : null,
    same_machine_as_linked: Boolean(isLinked && sameMachineAsLinked),
    start_after_linked: Boolean(isLinked && startAfterLinked),
    mono_units_used: Math.max(1, Number(monoUnitsUsed || 1)),
  };

  const { data: createdCmd, error: errorCmd } = await supabase
    .from("commandes")
    .insert([payload])
    .select()
    .single();

  if (errorCmd) {
    return { errorCmd, errorAssign: null };
  }

  // 2) garder-fou: assignation obligatoire et mapping machine_id/machineId
  if (!assignation) {
    // rollback commande si pas d'assignation
    await supabase.from("commandes").delete().eq("id", createdCmd.id);
    return { errorCmd: null, errorAssign: new Error("Assignation absente (mono).") };
  }

  const assignationPayload = {
    ...assignation,
    // Lier à la commande créée (et écraser toute valeur précédente)
    commande_id: createdCmd.id,
  };

  // shim temporaire si la BDD a encore `machineId` (camelCase)
  if (!assignationPayload.machineId && assignationPayload.machine_id) {
    assignationPayload.machineId = assignationPayload.machine_id;
  }

  // dernier garde-fou
  if (!assignationPayload.machine_id && !assignationPayload.machineId) {
    await supabase.from("commandes").delete().eq("id", createdCmd.id);
    return { errorCmd: null, errorAssign: new Error("machine_id manquant dans l’assignation.") };
  }

  // 3) insert assignation
  const { error: errorAssign } = await supabase
    .from("commandes_assignations")
    .insert([assignationPayload]);

  if (errorAssign) {
    // rollback commande si échec
    await supabase.from("commandes").delete().eq("id", createdCmd.id);
    return { errorCmd: null, errorAssign };
  }

  return { errorCmd: null, errorAssign: null, createdCmd };
}

export async function updateCommande(formData) {
  const { error } = await supabase
    .from("commandes")
    .update(formData)
    .eq("id", formData.id);
  return { error };
}

export async function deleteCommandeWithPlanning(id) {
  try {
    // Ancien "planning" (si encore présent)
    const { data: planningServeur, error: errorPlanningSelect } = await supabase
      .from("planning")
      .select("*")
      .eq("commandeId", id);

    if (errorPlanningSelect) {
      console.error("Erreur récupération planning:", errorPlanningSelect);
    }

    if (Array.isArray(planningServeur)) {
      for (const p of planningServeur) {
        const { error: errorDeletePlanning } = await supabase
          .from("planning")
          .delete()
          .eq("id", p.id);
        if (errorDeletePlanning) {
          console.error("Erreur suppression planning:", errorDeletePlanning);
        }
      }
    } else {
      // ok si la table n'est plus utilisée
      if (planningServeur !== null) {
        console.warn("planningServeur n'est pas un tableau :", planningServeur);
      }
    }

    const { error: deleteError } = await supabase
      .from("commandes")
      .delete()
      .eq("id", id);

    if (deleteError) return { error: deleteError };
    return { error: null };
  } catch (err) {
    console.error("Erreur suppression:", err);
    return { error: err };
  }
}
