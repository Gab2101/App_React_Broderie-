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

  const PRIORITY = { 'En cours': 0, 'A commencer': 1, 'En attente': 2, 'Terminée': 3 };
  const map = new Map();

  for (const c of commandes) {
    const key =
      c.machineAssignee ??
      c.machine ??
      c.machine_id ??
      (c.machineLabel ?? c.machine_name) ??
      'Non assignée';

    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  }

  for (const [k, list] of map) {
    list.sort((a, b) => {
      const pa = PRIORITY[a?.statut] ?? 99;
      const pb = PRIORITY[b?.statut] ?? 99;
      if (pa !== pb) return pa - pb;
      // fallback: plus ancienne d'abord
      return (a?.id ?? 0) - (b?.id ?? 0);
    });
  }

  return map;
}

// --- Dual-level grouping by machine and delivery date ---
export function groupByMachineAndDate(commandes = []) {
  if (!Array.isArray(commandes)) {
    console.warn("groupByMachineAndDate: commandes n'est pas un tableau", commandes);
    return new Map();
  }

  const PRIORITY = { 'En cours': 0, 'A commencer': 1, 'En attente': 2, 'Terminée': 3 };
  const map = new Map(); // machineKey -> { dateKey -> [orders] }

  for (const c of commandes) {
    const machineKey =
      c.machineAssignee ??
      c.machine ??
      c.machine_id ??
      (c.machineLabel ?? c.machine_name) ??
      'Non assignée';

    // Format delivery date consistently
    const dateObj = parseDate(c.dateLivraison || c.livraisonAt || c.deadline);
    const dateKey = dateObj
      ? dateObj.toISOString().split('T')[0] // YYYY-MM-DD format
      : 'Date inconnue';

    if (!map.has(machineKey)) {
      map.set(machineKey, new Map());
    }

    const dateMap = map.get(machineKey);
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }
    dateMap.get(dateKey).push(c);
  }

  // Sort orders within each date group
  for (const [machineKey, dateMap] of map) {
    for (const [dateKey, orders] of dateMap) {
      orders.sort((a, b) => {
        const pa = PRIORITY[a?.statut] ?? 99;
        const pb = PRIORITY[b?.statut] ?? 99;
        if (pa !== pb) return pa - pb;
        // fallback: older orders first
        return (a?.id ?? 0) - (b?.id ?? 0);
      });
    }

    // Sort date groups within machine (chronological)
    const sortedDates = Array.from(dateMap.entries()).sort(([dateA], [dateB]) => {
      if (dateA === 'Date inconnue') return 1;  // Unknown dates at end
      if (dateB === 'Date inconnue') return -1;
      return dateA.localeCompare(dateB); // YYYY-MM-DD string comparison
    });

    map.set(machineKey, new Map(sortedDates));
  }

  return map;
}
