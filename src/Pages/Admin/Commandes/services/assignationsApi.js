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
  
  // Calculer la durée totale appliquée pour la commande principale
  const totalCalcMinutes = Array.isArray(perMachine) 
    ? perMachine.reduce((sum, r) => sum + (Number(r.durationCalcMinutes) || 0), 0)
    : 0;
  
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
    // Durées calculées pour cohérence avec le planning
    duree_totale_heures: totalCalcMinutes / 60,
    // liaisons éventuelles
    linked_commande_id: formData.linked_commande_id || null,
    same_machine_as_linked: !!formData.same_machine_as_linked,
    start_after_linked: formData.start_after_linked ?? true,
  };

  const { data: cmdInserted, error: errorCmd } = await supabase
    .from("commandes")
    .insert(payloadCommande)
    .select("id")
    .single();

  if (errorCmd) return { errorCmd, errorAssign: null, commandeId: null };

  const commandeId = cmdInserted.id;

  // ---- 2) Préparer les assignations (une ligne par machine) -----------------
  const startISO = plannedStartISO || new Date().toISOString();
  const extraPercent = meta?.extraPercent ?? 0;
  const cleanPerItem = meta?.cleaningPerItemMinutes ?? 0;

  if (!Array.isArray(perMachine) || perMachine.length < 1) {
    return { errorCmd: null, errorAssign: new Error("Aucune machine fournie."), commandeId };
  }

  const rows = perMachine.map((r) => {
    const planned_start = r.planned_start ?? plannedStartISO ?? null;
    const planned_end = r.planned_end ?? null;
    
    // Appliquer l'arrondi aux 5 minutes pour cohérence
    const roundedStart = planned_start ? roundMinutesTo5(new Date(planned_start)) : null;
    const roundedEnd = planned_end ? roundMinutesTo5(new Date(planned_end)) : null;
    const calc = Math.max(0, Math.round(Number(r.durationCalcMinutes || 0)));
    return {
      commande_id: commandeId,
      machine_id: r.machineId,
      qty,
      status: "A commencer",
      planned_start: roundedStart ? roundedStart.toISOString() : null,
      planned_end: roundedEnd ? roundedEnd.toISOString() : null,
      duration_calc_minutes: calc,            // et la durée finale
      extra_percent: extraPercent,
      cleaning_minutes: Math.round(cleanPerItem * qty),
      // NE PAS envoyer "period" (colonne générée)
    };
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
