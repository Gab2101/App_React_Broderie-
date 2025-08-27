// src/Pages/Admin/Commandes/utils/linked.js

// Récupère la dernière fin planifiée + l'id machine pour une commande liée
export const getLinkedLastFinishAndMachineId = (planningArr, commandeId) => {
  const rows = (planningArr || []).filter((p) => p.commandeId === commandeId);
  if (!rows.length) return { lastFinish: null, machineId: null };
  rows.sort((a, b) => new Date(a.fin) - new Date(b.fin));
  const last = rows[rows.length - 1];
  return { lastFinish: new Date(last.fin), machineId: last.machineId ?? null };
};

// Trouve une machine par son nom (tolère espaces/casse)
export const getMachineByName = (machinesArr, name) =>
  machinesArr.find(
    (m) => (m.nom || "").trim().toLowerCase() === String(name || "").trim().toLowerCase()
  ) || null;
