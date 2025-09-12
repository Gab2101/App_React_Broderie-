// src/Pages/Admin/Commandes/utils/grouping.js

// --- helpers ---
function getSingleMachineKey(c) {
  const idCandidates = [
    c.machine_id,
    c.machineId,
    c.machine_assignee_id,
    c.assigned_machine_id,
    c.machineAssignee,
    c.machine,
  ].filter((v) => v !== undefined && v !== null);

  for (const v of idCandidates) {
    if (Array.isArray(v)) return null;             // multi → on ignore dans ce grouping
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  if (Array.isArray(c.machines)) {
    if (c.machines.length === 1) return String(c.machines[0]);
    return null;                                   // multi → on ignore
  }

  const nameCandidates = [c.machine_name, c.machineNom, c.machineLabel, c.machineLibelle];
  for (const s of nameCandidates) {
    if (typeof s === "string" && s.trim()) return s.trim();
  }

  return null;
}

function parseDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d?.getTime?.()) ? null : d;
}

function firstNonNull(...vals) {
  for (const v of vals) if (v != null) return v;
  // valeur très grande pour pousser à la fin si tout est null
  return new Date(8640000000000000);
}

function compareCommandeAsc(a, b) {
  const da = firstNonNull(
    parseDate(a.dateLivraison || a.livraisonAt || a.deadline),
    parseDate(a.startAt || a.date_debut_planning),
    parseDate(a.createdAt || a.created_at)
  );
  const db = firstNonNull(
    parseDate(b.dateLivraison || b.livraisonAt || b.deadline),
    parseDate(b.startAt || b.date_debut_planning),
    parseDate(b.createdAt || b.created_at)
  );
  return da - db;
}

// --- main ---
export function groupAndSortByMachine(commandes = []) {
  if (!Array.isArray(commandes)) {
    console.warn("groupAndSortByMachine: commandes n'est pas un tableau", commandes);
    return new Map();
  }

  const acc = new Map();

  for (const cmd of commandes) {
    const key = getSingleMachineKey(cmd);
    if (!key) continue; // on saute les multi-machines ici

    // on garantit un tableau à chaque clé
    const list = acc.get(key);
    if (!Array.isArray(list)) {
      acc.set(key, [cmd]);
    } else {
      list.push(cmd);
    }
  }

  // tri sûr pour chaque groupe
  for (const [key, list] of acc.entries()) {
    if (Array.isArray(list)) {
      list.sort(compareCommandeAsc);
    } else {
      console.warn(`groupAndSortByMachine: valeur non-tableau pour la clé ${key}`, list);
      acc.set(key, []);
    }
  }

  return acc;
}
