// src/Pages/Admin/Commandes/utils/linked.js
// Helpers locaux sûrs
const toValidDate = (v) => {
  const d = v instanceof Date ? new Date(v.getTime()) : new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
};
const isValidDate = (d) => d instanceof Date && Number.isFinite(d.getTime());

// Récupère la dernière fin planifiée + l'id machine pour une commande liée
// NB: `lastFinish` est un instant UTC (timestamptz). Pour l'affichage, formater en Europe/Paris hors de ce module.
export const getLinkedLastFinishAndMachineId = (planningArr, commandeId) => {
  const rows = (planningArr || [])
    .filter((p) => p && p.commandeId === commandeId)
    .map((p) => ({ ...p, _finDate: toValidDate(p?.fin) }))
    .filter((p) => isValidDate(p._finDate));
  if (!rows.length) return { lastFinish: null, machineId: null };

  rows.sort((a, b) => a._finDate.getTime() - b._finDate.getTime());
  const last = rows[rows.length - 1];

  return { lastFinish: new Date(last._finDate.getTime()),machineId: last.machineId ?? null,};
};

// Trouve une machine par son nom (tolère espaces/casse)
export const getMachineByName = (machinesArr, name) =>
  machinesArr.find(
    (m) => (m.nom || "").trim().toLowerCase() === String(name || "").trim().toLowerCase()
  ) || null;
