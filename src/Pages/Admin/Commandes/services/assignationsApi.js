// src/Pages/Admin/Commandes/services/assignationsApi.js
import { supabase } from "../../../../supabaseClient";

/**
 * Crée une commande (table `commandes`) + ses assignations (table `commandes_assignations`).
 * On attend la sortie du modal multi-machines :
 *   {
 *     formData: {...},                           // champs de la commande
 *     perMachine: [                              // une ligne par machine
 *       {
 *         machineId: string,
 *         quantity: number,
 *         durationTheoreticalMinutes: number,    // minutes "théorique"
 *         durationCalcMinutes: number            // minutes finales (efficacité + surcote + nettoyage)
 *       }, ...
 *     ],
 *     meta: { extraPercent, cleaningPerItemMinutes, efficacitePercent, points, vitesseMoyenne, quantity } | null,
 *     plannedStartISO: string | undefined        // si non fourni => now()
 *   }
 */
export async function createCommandeWithAssignations({ formData, perMachine, meta, plannedStartISO }) {
  // ---- 1) Créer la commande -------------------------------------------------
  const payloadCommande = {
    numero: formData.numero,
    client: formData.client,
    quantite: Number(formData.quantite),
    points: Number(formData.points),
    vitesseMoyenne: formData.vitesseMoyenne ? Number(formData.vitesseMoyenne) : null,
    dateLivraison: formData.dateLivraison || null,
    urgence: Number(formData.urgence || 3),
    types: formData.types || [],
    options: formData.options || [],
    statut: "A commencer",
    multi_machine: true,
    // liaisons éventuelles
    linked_commande_id: formData.linked_commande_id || null,
    same_machine_as_linked: !!formData.same_machine_as_linked,
    start_after_linked: formData.start_after_linked ?? true,
  };

  const { data: cmdInserted, error: errorCmd } = await supabase

  if (errorCmd) return { errorCmd, errorAssign: null, commandeId: null };
    const durCalc = Math.max(0, Math.round(Number(r.durationCalcMinutes || 0)));
    const durTheo = Math.max(0, Math.round(Number(r.durationTheoreticalMinutes || 0)));
    const cleaningMinutes = Math.max(0, Math.round(Number(r.cleaningMinutes || 0)));
    const extraPercent = Math.max(0, Number(r.extraPercent || 0));
    
    const planned_start = r.planned_start_iso_utc || plannedStartISO || new Date().toISOString();
    const planned_end = r.planned_end_iso_utc || null;

    return {
      commande_id: commandeId,
      machine_id: r.machineId,
      qty,
      status: "A commencer",
      planned_start: startISO,                // la fin sera calculée par trigger en DB
      duration_minutes: theo,                 // on garde la durée "base"
      duration_minutes: durCalc || durTheo,
      cleaning_minutes: cleaningMinutes,
      extra_percent: extraPercent,
      cleaning_minutes: Math.round(cleanPerItem * qty),
  });

  // validation simple
  if (rows.some((x) => x.qty <= 0)) {
    return { errorCmd: null, errorAssign: new Error("Répartition invalide (qty <= 0)."), commandeId };
  }

  // ---- 3) Insertion dans la bonne table (PLURIEL) ---------------------------
  const { data: assign, error: errorAssign } = await supabase
    .from("commandes_assignations")
    .insert(rows)
    .select("id, machine_id, qty, planned_start, planned_end");

  return { errorCmd: null, errorAssign, commandeId, assign };
}
