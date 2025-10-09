// src/Pages/Admin/Commandes/services/assignationsApi.js
import supabase from '@/lib/supabaseClient';

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

// Crée une commande + ses assignations (multi-machine).
export async function createCommandeWithAssignations({
  formData,
  perMachine,
  meta = null,          // non utilisé/stocker ici, conservé pour compat
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
    return { errorCmd: null, errorAssign: new Error("Aucune assignation valide.") };
  }

  // -------- 1) INSERT commande --------
  const payloadCommande = {
    numero: formData.numero ?? null,
    client: formData.client ?? null,
    quantite: toPosInt(formData.quantite, 0),
    points: toNonNegInt(formData.points, 0),
    vitesseMoyenne: Number.isFinite(Number(formData.vitesseMoyenne))
      ? Number(formData.vitesseMoyenne)
      : null,
    // IMPORTANT: toujours stocker en UTC (timestamptz)
    dateLivraison: toUTCISOStringSafe(formData.dateLivraison),
    urgence: Number.isFinite(Number(formData.urgence)) ? Number(formData.urgence) : 3,
    types: toArray(formData.types),
    options: toArray(formData.options),
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
  const cleanRow = (obj) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

  const rows = valid.map((r) => {
    const qty = toPosInt(r.quantity, 0);

    // Choix de la durée : on privilégie la durée "calculée" si fournie, sinon théorique
    const durCalc = Number.isFinite(Number(r.durationCalcMinutes))
      ? toNonNegInt(r.durationCalcMinutes)
      : undefined;

    const durTheo = Number.isFinite(Number(r.durationTheoreticalMinutes))
      ? toNonNegInt(r.durationTheoreticalMinutes)
      : 0;

    const duration_minutes = durCalc ?? durTheo; // colonne existante

    // Dates (UTC strict). On honore la date par ligne si fournie, sinon fallback commun
    const planned_start =
      toUTCISOStringSafe(r.planned_start) ||
      toUTCISOStringSafe(plannedStartISO) ||
      null;

    const planned_end = toUTCISOStringSafe(r.planned_end);

    const base = {
      commande_id: commandeId,
      // Si machine_id est un entier, on le normalise ; si c'est UUID/texte, on garde tel quel
      machine_id: toPosInt(r.machineId, null) || r.machineId,
      qty,
      status: "A commencer",
      planned_start,
      planned_end,
      duration_minutes,
      // duration_calc_minutes: durCalc, // décommente si la colonne existe
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
