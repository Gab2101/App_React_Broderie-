// src/Pages/Admin/Commandes/services/assignationsApi.js
import { supabase } from "../../../../supabaseClient";

/* ===== Helpers locaux sûrs ===== */
const toUTCISOStringSafe = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  const t = d.getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};
const toPosInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
};
const toNonNegInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : def;
};
const toArray = (v) => (Array.isArray(v) ? v : []);

/**
 * Crée une commande (table `commandes`) + ses assignations (table `commandes_assignations`).
 * On attend la sortie du modal multi-machines.
 */
export async function createCommandeWithAssignations({
  formData,
  perMachine,
  meta,
  plannedStartISO,
}) {
  /* ---- 1) Créer la commande --------------------------------------------- */
  const payloadCommande = {
    numero: formData?.numero ?? null,
    client: formData?.client ?? null,
    quantite: toPosInt(formData?.quantite, 0),
    points: toNonNegInt(formData?.points, 0),
    vitesseMoyenne: Number.isFinite(Number(formData?.vitesseMoyenne))
      ? Number(formData.vitesseMoyenne)
      : null,
    // Toujours stocker en UTC (timestamptz)
    dateLivraison: toUTCISOStringSafe(formData?.dateLivraison),
    urgence: Number.isFinite(Number(formData?.urgence)) ? Number(formData.urgence) : 3,
    types: toArray(formData?.types),
    options: toArray(formData?.options),
    statut: "A commencer",
    multi_machine: true,
    // liaisons éventuelles
    linked_commande_id: formData?.linked_commande_id || null,
    same_machine_as_linked: !!formData?.same_machine_as_linked,
    start_after_linked: formData?.start_after_linked ?? true,
  };

  const { data: cmdInserted, error: errorCmd } = await supabase
    .from("commandes")
    .insert(payloadCommande)
    .select("id")
    .single();

  if (errorCmd || !cmdInserted) {
    return { errorCmd, errorAssign: null, commandeId: null };
  }

  const commandeId = cmdInserted.id;

  /* ---- 2) Préparer les assignations ------------------------------------- */
  const startISO =
    toUTCISOStringSafe(plannedStartISO) || new Date().toISOString();

  const extraPercent = Number.isFinite(Number(meta?.extraPercent))
    ? Number(meta.extraPercent)
    : 0;

  const cleanPerItem = Number.isFinite(Number(meta?.cleaningPerItemMinutes))
    ? Number(meta.cleaningPerItemMinutes)
    : 0;

  if (!Array.isArray(perMachine) || perMachine.length < 1) {
    return {
      errorCmd: null,
      errorAssign: new Error("Aucune machine fournie."),
      commandeId,
    };
  }

  const rows = perMachine.map((r) => {
    const qty = toPosInt(r?.quantity, 0);
    const theo = toNonNegInt(r?.durationTheoreticalMinutes, 0);
    const calc = toNonNegInt(r?.durationCalcMinutes, 0);

    return {
      commande_id: commandeId,
      // si machine_id est un entier -> on normalise ; sinon (UUID/texte) on garde l’original
      machine_id: toPosInt(r?.machineId, null) || r?.machineId,
      qty,
      status: "A commencer",
      // La fin pourra être calculée côté DB (trigger) si présent
      planned_start: startISO,
      duration_minutes: theo,          // durée "base"
      duration_calc_minutes: calc,     // durée finale (efficacité + surcote + nettoyage)
      extra_percent: extraPercent,
      cleaning_minutes: toNonNegInt(cleanPerItem * qty, 0),
      // NE PAS envoyer "period" (colonne générée)
    };
  });

  // validation simple
  if (rows.some((x) => !x.machine_id || x.qty <= 0)) {
    return {
      errorCmd: null,
      errorAssign: new Error("Répartition invalide (machine manquante ou qty <= 0)."),
      commandeId,
    };
  }

  /* ---- 3) Insertion dans la bonne table (PLURIEL) ------------------------ */
  const { data: assign, error: errorAssign } = await supabase
    .from("commandes_assignations")
    .insert(rows)
    .select("id, machine_id, qty, planned_start, planned_end");

  return { errorCmd: null, errorAssign, commandeId, assign };
}
