// src/Pages/Admin/Commandes/utils/grouping.js
export function groupAndSortByMachine(commandes = []) {
  const buckets = new Map();

  for (const c of commandes) {
    const machineKey = getSingleMachineKey(c);
    if (!machineKey) continue; // ignore sans-machine et multi (comme demandé)

    const key = String(machineKey).trim();
    if (!key) continue;

    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(c);
  }

  for (const [list] of buckets) {
    list.sort(compareCommandeAsc);
  }
  return buckets;
}

// --- helpers ---

function getSingleMachineKey(c) {
  // 1) champs ID / clé probable
  const idCandidates = [
    c.machine_id,
    c.machineId,
    c.machine_assignee_id,
    c.assigned_machine_id,
    c.machineAssignee, // souvent utilisé chez toi
    c.machine,         // parfois string, parfois id
  ].filter((v) => v !== undefined && v !== null);

  for (const v of idCandidates) {
    // si tableau → multi => ignorer
    if (Array.isArray(v)) return null;
    // autorise number ou string
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  // 2) si tu as un tableau machines
  if (Array.isArray(c.machines)) {
    if (c.machines.length === 1) return c.machines[0];
    return null; // multi => ignorer
  }

  // 3) nom machine éventuel (dernier recours)
  const nameCandidates = [c.machine_name, c.machineNom, c.machineLabel, c.machineLibelle];
  for (const s of nameCandidates) {
    if (typeof s === "string" && s.trim()) return s.trim();
  }

  return null; // rien trouvé
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

function parseDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d?.getTime?.()) ? null : d;
}

function firstNonNull(...vals) {
  for (const v of vals) if (v != null) return v;
  return new Date(8640000000000000); // push à la fin
}
