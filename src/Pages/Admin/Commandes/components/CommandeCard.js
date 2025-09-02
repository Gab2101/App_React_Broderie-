// src/Pages/Admin/Commandes/services/assignationsApi.js
import { supabase } from "../../../../supabaseClient";

// ✅ petit helper local: arrondit une Date au multiple supérieur de 5 min
function roundDateTo5(dateInput) {
  const d = new Date(dateInput);
  const step = 5 * 60 * 1000;
  return new Date(Math.ceil(d.getTime() / step) * step);
}

export async function createCommandeWithAssignations({ formData, perMachine, meta, plannedStartISO }) {
  // ---- 1) Créer la commande -------------------------------------------------
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
    duree_totale_heures: totalCalcMinutes / 60,
    mono_units_used: 1,
    extra_percent: meta?.coefPercent ? Math.max(0, meta.coefPercent - 100) : 0,
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

  // ---- 2) Préparer les assignations ----------------------------------------
  if (!Array.isArray(perMachine) || perMachine.length < 1) {
    return { errorCmd: null, errorAssign: new Error("Aucune machine fournie."), commandeId };
  }

  const rows = perMachine.map((r) => {
    // ✅ qty provient du split multi: r.quantity (garde 'qty' comme nom de colonne DB)
    const qty = Number(r.quantity ?? r.qty ?? 0);

    const planned_start = r.planned_start ?? plannedStartISO ?? null;
    const planned_end   = r.planned_end ?? null;

    // ✅ arrondi 5 min sur les Dates
    const roundedStart = planned_start ? roundDateTo5(planned_start) : null;
    const roundedEnd   = planned_end   ? roundDateTo5(planned_end)   : null;

    const calc = Math.max(0, Math.round(Number(r.durationCalcMinutes || 0)));
    const extraPercent = meta?.extraPercent ?? 0;
    const cleanPerItem = meta?.cleaningPerItemMinutes ?? 0;

    return {
      commande_id: commandeId,
      machine_id: r.machineId,
      qty,                                   // <-- colonne de la table commandes_assignations
      status: "A commencer",
      planned_start: roundedStart ? roundedStart.toISOString() : null,
      planned_end:   roundedEnd   ? roundedEnd.toISOString()   : null,
      duration_calc_minutes: calc,
      extra_percent: extraPercent,
      cleaning_minutes: Math.round(cleanPerItem * qty),
    };
  });

  // validation simple
  if (rows.some((x) => x.qty <= 0)) {
    return { errorCmd: null, errorAssign: new Error("Répartition invalide (qty <= 0)."), commandeId };
  }

  // ---- 3) Insert ------------------------------------------------------------
  const { data: assign, error: errorAssign } = await supabase
    .from("commandes_assignations")
    .insert(rows)
    .select("id, machine_id, qty, planned_start, planned_end");

  return { errorCmd: null, errorAssign, commandeId, assign };
}
