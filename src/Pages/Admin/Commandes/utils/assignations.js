// src/Pages/Admin/Commandes/services/assignationsApi.js
import { supabase } from "../../../../supabaseClient";

/**
 * Crée une commande + ses assignations (multi-machine).
 *
 * @param {Object} params
 * @param {Object} params.formData - données du formulaire (numero, client, quantite, points, vitesseMoyenne, dateLivraison, urgence, types, options, ... + liens)
 * @param {Array}  params.perMachine - [{ machineId, quantity, durationTheoreticalMinutes, durationCalcMinutes?, planned_start?, planned_end? }, ...]
 * @param {Object} [params.meta] - métadonnées facultatives (non stockées ici)
 * @param {string} [params.plannedStartISO] - fallback "global" si un item n’a pas de planned_start
 *
 * @returns {Promise<{ errorCmd: any, errorAssign: any, commandeId?: number, assignationIds?: number[] }>}
 */
export async function createCommandeWithAssignations({
  formData,
  perMachine,
  meta = null,
  plannedStartISO = null,
}) {
  // -------- Validation rapide --------
  const list = Array.isArray(perMachine) ? perMachine : [];
  const valid = list.filter(
    (r) =>
      r &&
      r.machineId &&
      Number(r.quantity) > 0 &&
      (Number(r.durationCalcMinutes) >= 0 ||
        Number(r.durationTheoreticalMinutes) >= 0)
  );
  if (valid.length === 0) {
    return { errorCmd: null, errorAssign: new Error("Aucune assignation valide." ) };
  }

  // -------- 1) INSERT commande --------
  const payloadCommande = {
    numero: formData.numero ?? null,
    client: formData.client ?? null,
    quantite: formData.quantite ? Number(formData.quantite) : 0,
    points: formData.points ? Number(formData.points) : 0,
    vitesseMoyenne: formData.vitesseMoyenne ? Number(formData.vitesseMoyenne) : null,
    dateLivraison: formData.dateLivraison || null,
    urgence: formData.urgence ? Number(formData.urgence) : 3,
    types: Array.isArray(formData.types) ? formData.types : [],
    options: Array.isArray(formData.options) ? formData.options : [],
    statut: "A commencer",
    multi_machine: true, // important pour distinguer les flux
    // champs de liaison éventuels
    linked_commande_id: formData.linked_commande_id || null,
    same_machine_as_linked: !!formData.same_machine_as_linked,
    start_after_linked: formData.start_after_linked ?? true,
  };

  const { data: cmdInserted, error: errorCmd } = await supabase
    .from("commandes")
    .insert(payloadCommande)
    .select("id")
    .single();

  if (errorCmd || !cmdInserted) {
    return { errorCmd, errorAssign: null };
  }

  const commandeId = cmdInserted.id;

  // -------- 2) Construire les assignations --------
  // Helper pour enlever les clés undefined (évite les erreurs si la colonne n’existe pas)
  const cleanRow = (obj) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

  const rows = valid.map((r) => {
    const qty = Number(r.quantity || 0);

    // Choix de la durée : on privilégie la durée "calculée" si fournie, sinon théorique
    const durCalc = Number.isFinite(r.durationCalcMinutes)
      ? Math.max(0, Math.round(Number(r.durationCalcMinutes)))
      : undefined;

    const durTheo = Number.isFinite(r.durationTheoreticalMinutes)
      ? Math.max(0, Math.round(Number(r.durationTheoreticalMinutes)))
      : 0;

    const duration_minutes = durCalc ?? durTheo; // pour la colonne "duration_minutes" existante

    // Dates (on honore les dates par ligne si fournies, sinon fallback commun)
    const planned_start = r.planned_start ?? plannedStartISO ?? null;
    const planned_end = r.planned_end ?? null;

    const base = {
      commande_id: commandeId,
      machine_id: r.machineId,
      qty,
      status: "A commencer",
      planned_start,
      planned_end,
      duration_minutes,           // <-- colonne existante dans ta table
      // duration_calc_minutes: durCalc, // <-- décommente si ta table possède cette colonne
    };

    return cleanRow(base);
  });

  if (rows.length === 0) {
    return { errorCmd: null, errorAssign: new Error("Rows assignations vides.") };
  }

  // -------- 3) INSERT assignations --------
  const { data: insertedAssign, error: errorAssign } = await supabase
    .from("commande_assignations")
    .insert(rows)
    .select("id");

  if (errorAssign) {
    return { errorCmd: null, errorAssign };
  }

  const assignationIds = Array.isArray(insertedAssign)
    ? insertedAssign.map((r) => r.id)
    : [];

  return { errorCmd: null, errorAssign: null, commandeId, assignationIds };
}
