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
  planning,
  commandes,
  machines,
  nettoyageRules,
  articleTags,
  linked: { isLinked, linkedCommandeId, sameMachineAsLinked, startAfterLinked },
}) {
  // Validation compatibilité
  const machineLabels = toLabelArray(machine.etiquettes);
  const neededTypes = toLabelArray(formData.types);
  const ok = neededTypes.every((t) => machineLabels.includes(t));
  if (!ok) {
    return { errorCmd: { message: "Machine incompatible (types)." } };
  }

  let debutMinOverride = null;
  if (isLinked && linkedCommandeId && startAfterLinked) {
    const { lastFinish } = getLinkedLastFinishAndMachineId(planning, Number(linkedCommandeId));
    if (lastFinish) debutMinOverride = nextWorkStart(lastFinish);
  }

  if (isLinked && sameMachineAsLinked && linkedCommandeId) {
    const { machineId: linkedMachineId } = getLinkedLastFinishAndMachineId(
      planning,
      Number(linkedCommandeId)
    );
    const linkedCmd = commandes.find((c) => c.id === Number(linkedCommandeId));
    const linkedMachineByName = linkedCmd?.machineAssignee
      ? getMachineByName(machines, linkedCmd.machineAssignee)
      : null;
    const expectedId = linkedMachineId ?? linkedMachineByName?.id ?? null;

    if (expectedId && String(machine.id) !== String(expectedId)) {
      return { errorCmd: { message: "La machine sélectionnée doit être la même que celle de la commande liée." } };
    }
  }

  // Recalcule théorique avec nb de têtes effectif (mono ou multi)
  const etiquetteArticle = formData.types?.[0] || null;
  const vitesseBase = parseInt(formData.vitesseMoyenne, 10) || 680;

  const effectiveNbTetes = Number(machine.nbTetes || 1) * Math.max(1, Number(monoUnitsUsed || 1));

  const nettoyageParArticleSec = computeNettoyageSecondsForOrder(
    etiquetteArticle,
    formData.options,
    nettoyageRules,
    articleTags
  );

  const {
    dureeBroderieHeures,
    dureeNettoyageHeures,
    dureeTotaleHeures: dureeTotaleHeuresTheorique,
  } = calculerDurees({
    quantite: Number(formData.quantite || 0),
    points: Number(formData.points || 0),
    vitesse: Number(vitesseBase),
    nbTetes: effectiveNbTetes, // 👈 applique monoUnitsUsed ici
    nettoyageParArticleSec,
  });

  const minutesTheoriquesLocal = Math.round(dureeTotaleHeuresTheorique * 60);
  const minutesReellesLocal = roundMinutesTo5(
    Math.round((minutesTheoriquesLocal * coef) / 100)
  );

  // Début / fin
  const now = Date.now();
  const planifies = (planning || [])
    .filter((p) => p.machineId === machine.id && new Date(p.fin).getTime() >= now)
    .sort((a, b) => new Date(a.debut) - new Date(b.debut));

  const nowDispo = getNextFullHour();
  const lastFin = planifies.length ? new Date(planifies[planifies.length - 1].fin) : null;
  const anchorBase = lastFin && lastFin > nowDispo ? lastFin : nowDispo;
  const anchor = debutMinOverride && debutMinOverride > anchorBase ? debutMinOverride : anchorBase;
  const debut = nextWorkStart(anchor);
  const fin = addWorkingHours(debut, minutesReellesLocal / 60);

  // Apply 5-minute rounding for schedule consistency
  const roundedDebut = roundMinutesTo5(debut);
  const roundedFin = roundMinutesTo5(fin);

  const { id, ...formSansId } = formData;

  const dureeTotaleHeuresReelleAppliquee = minutesReellesLocal / 60;
  const dureeTotaleHeuresArrondie = Math.ceil(dureeTotaleHeuresReelleAppliquee);

  const payload = {
    ...formSansId,
    machineAssignee: machine.nom,
    vitesseMoyenne: vitesseBase,
    duree_broderie_heures: dureeBroderieHeures,
    duree_nettoyage_heures: dureeNettoyageHeures,
    duree_totale_heures: minutesReellesLocal / 60, // Durée réelle appliquée (avec coef)
    duree_totale_heures_arrondie: dureeTotaleHeuresArrondie,
    statut: "A commencer",
    linked_commande_id: isLinked ? Number(linkedCommandeId) : null,
    same_machine_as_linked: Boolean(isLinked && sameMachineAsLinked),
    start_after_linked: Boolean(isLinked && startAfterLinked),
    mono_units_used: Math.max(1, Number(monoUnitsUsed || 1)),
    extra_percent: Math.max(0, coef - 100), // Stocke le pourcentage additionnel appliqué
  };

  const { data: createdCmd, error: errorCmd } = await supabase
    .from("commandes")
    .insert([payload])
    .select()
    .single();

  if (errorCmd) return { errorCmd };

  const { error: errorPlanning } = await supabase.from("planning").insert([
    {
      machineId: machine.id,
      commandeId: createdCmd.id,
      debut: roundedDebut.toISOString(),
      debutTheorique: roundedDebut.toISOString(),
      fin: roundedFin.toISOString(),
    },
  ]);

  return { createdCmd, errorPlanning };
}

export async function updateCommande(formData) {
  const { error } = await supabase.from("commandes").update(formData).eq("id", formData.id);
  return { error };
}

export async function deleteCommandeWithPlanning(id) {
  try {
    // 1. D'abord, supprimer les références à cette commande dans d'autres commandes
    const { error: unlinkError } = await supabase
      .from("commandes")
      .update({
        linked_commande_id: null,
        same_machine_as_linked: false,
        start_after_linked: false
      })
      .eq("linked_commande_id", id);

    if (unlinkError) {
      console.error("Erreur suppression des liens:", unlinkError);
      return { error: unlinkError };
    }

    // 2. Ensuite, supprimer le planning associé
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

    // 3. Enfin, supprimer la commande elle-même
    const { error: deleteError } = await supabase.from("commandes").delete().eq("id", id);
    if (deleteError) return { error: deleteError };

    return { error: null };
  } catch (err) {
    console.error("Erreur suppression:", err);
    return { error: err };
  }
}
