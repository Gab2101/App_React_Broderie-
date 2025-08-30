// src/Pages/Admin/Commandes/components/MultiMachineSplitModal.jsx
import React, { useMemo, useState, useCallback } from "react";

/**
 * Props:
 * - isOpen, onClose
 * - machines: [{ id, nom, etiquettes? }]
 * - quantity: number
 * - points: number
 * - vitesseMoyenne: number            // pts/min (si > 10000 => pts/heure)
 * - efficacitePercent: number         // 100 nominal; 80 => x(100/80)
 * - extraPercent: number              // +%
 * - cleaningPerItemMinutes: number    // minutes *par pièce*
 * - defaultSelected?: string[]
 * - onConfirm: ({ machines, perMachine, totalDurationHours, meta, flow: "multi" }) => void
 *
 * ⚙️ Options de calcul (nouvelles, toutes facultatives) :
 * - roundingMode: "none" | "ceil5" | "ceil15"        (default: "none")
 * - cleaningMode: "per_item" | "per_batch"           (default: "per_item")
 * - cleaningBatchMinutes: number                     (default: 0)
 * - totalMode: "sum" | "max"                         (default: "sum")
 */

export default function MultiMachineSplitModal({
  isOpen,
  onClose,
  machines = [],
  quantity = 1,
  points = 0,
  vitesseMoyenne = 600,
  efficacitePercent = 100,
  extraPercent = 0,
  cleaningPerItemMinutes = 0,
  defaultSelected = [],
  onConfirm,

  // ⚙️ Nouveaux réglages (avec défauts)
  roundingMode = "none",
  cleaningMode = "per_item",
  cleaningBatchMinutes = 0,
  totalMode = "sum",
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => defaultSelected.map(String));

  // Inputs éditables (si tu souhaites les exposer dans l’UI)
  const [effInput, setEffInput] = useState(String(efficacitePercent ?? 100));
  const [extraInput, setExtraInput] = useState(String(extraPercent ?? 0));
  const [cleanInput, setCleanInput] = useState(String(cleaningPerItemMinutes ?? 0));

  const effUsed = Math.max(1, Number(effInput) || 100); // évite /0
  const extraUsed = Math.max(0, Number(extraInput) || 0);
  const cleanPerItemUsed = Math.max(0, Number(cleanInput) || 0);
  const cleanBatchUsed = Math.max(0, Number(cleaningBatchMinutes) || 0);

  const options = useMemo(
    () =>
      machines.map((m) => ({
        value: String(m.id),
        label: m.nom ?? `Machine ${m.id}`,
        tags: Array.isArray(m.etiquettes) ? m.etiquettes.join(" ").toLowerCase() : "",
      })),
    [machines]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.tags.includes(q)
    );
  }, [options, query]);

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // ---------- Calculs ----------

  const normalizeSpeedPtsPerMin = (v) => {
    let s = Number(v) || 0;
    if (s <= 0) return 600;       // plancher safe
    if (s > 10000) s = s / 60;    // saisi en points/HEURE
    return s;
  };

  // ✅ computeDurations stabilisée
  const computeDurations = useCallback((qty) => {
  const q = Number(qty) || 0;
  const ptsPerItem = Number(points) || 0;
  const speed = normalizeSpeedPtsPerMin(vitesseMoyenne);

  const theoreticalMinutes = (ptsPerItem * q) / speed;
  const effAdjusted = theoreticalMinutes * (100 / effUsed);
  const withExtra = effAdjusted * (1 + extraUsed / 100);
  const cleaningMinutes =
    cleaningMode === "per_batch" ? cleanBatchUsed : cleanPerItemUsed * q;

  const raw = withExtra + cleaningMinutes;

  // ⬇️ ici inline au lieu de `applyRounding`
  let rounded;
  if (roundingMode === "ceil5") rounded = Math.ceil(raw / 5) * 5;
  else if (roundingMode === "ceil15") rounded = Math.ceil(raw / 15) * 15;
  else rounded = Math.round(raw);

  const durationCalcMinutes = Math.max(0, rounded);
  const durationHours = durationCalcMinutes / 60;

  return {
    theoreticalMinutes,
    durationCalcMinutes,
    durationHours,
  };
}, [points, vitesseMoyenne, effUsed, extraUsed, cleaningMode, cleanPerItemUsed, cleanBatchUsed, roundingMode]);

  // Répartition équitable (ex: 11 sur 3 -> [4,4,3])
  const splitEven = (total, n) => {
    const t = parseInt(total || "0", 10);
    if (!Number.isFinite(t) || t < 0 || !Number.isInteger(n) || n <= 0) return [];
    const base = Math.floor(t / n);
    let rest = t % n;
    const arr = new Array(n).fill(base);
    for (let i = 0; i < n && rest > 0; i++) { arr[i] += 1; rest--; }
    return arr;
  };

  const { perMachine, totalDurationHours, errorText } = useMemo(() => {
    if (selected.length === 0) {
      return { perMachine: [], totalDurationHours: 0, errorText: "Sélectionnez au moins une machine." };
    }

    const qty = Number(quantity) || 0;

    // Cas 1 machine
    if (selected.length === 1) {
      const d = computeDurations(qty);
      return {
        perMachine: [{
          machineId: selected[0],
          quantity: qty,
          durationTheoreticalMinutes: d.theoreticalMinutes,
          durationCalcMinutes: d.durationCalcMinutes,
          durationHours: d.durationHours,
        }],
        totalDurationHours: d.durationHours,
        errorText: null,
      };
    }

    // Plusieurs machines → répartir
    if (qty < selected.length) {
      return {
        perMachine: [],
        totalDurationHours: 0,
        errorText: `La quantité (${qty}) doit être ≥ au nombre de machines sélectionnées (${selected.length}).`,
      };
    }

    const shares = splitEven(qty, selected.length);
    const rows = selected.map((mid, i) => {
      const q = shares[i];
      const d = computeDurations(q);
      return {
        machineId: mid,
        quantity: q,
        durationTheoreticalMinutes: d.theoreticalMinutes,
        durationCalcMinutes: d.durationCalcMinutes,
        durationHours: d.durationHours,
      };
    });

    // Somme OU durée critique
    const total =
      totalMode === "max"
        ? rows.reduce((max, r) => Math.max(max, r.durationHours), 0)
        : rows.reduce((s, r) => s + r.durationHours, 0);

    return { perMachine: rows, totalDurationHours: total, errorText: null };
  }, [selected, quantity, computeDurations, totalMode]);

  const submit = () => {
    if (errorText) return;
    onConfirm?.({
      machines: selected.slice(),
      perMachine,
      totalDurationHours,
      meta: {
        efficacitePercent: effUsed,
        extraPercent: extraUsed,
        cleaningPerItemMinutes: cleanPerItemUsed,
        cleaningBatchMinutes: cleanBatchUsed,
        cleaningMode,
        roundingMode,
        totalMode,
        points,
        vitesseMoyenne,
        quantity,
      },
      flow: "multi",
    });
  };

  if (!isOpen) return null;

  // ---------- UI ----------
  const panelStyle = {
    border: "1px solid #eee",
    borderRadius: 10,
    padding: 8,
    background: "#fafafa",
  };

  const cardStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #eaeaea",
    borderRadius: 10,
    padding: "8px 10px",
    background: "#fff",
    cursor: "pointer",
  };

  const inputStyle = {
    flex: 1,
    minWidth: 0,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #e3e3e3",
    background: "#fff",
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 920 }}>
        <div className="modal__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Répartition multi-machines</h3>
          <button className="close" onClick={onClose}>×</button>
        </div>

        <div className="modal__body" style={{ display: "grid", gap: 12 }}>
          {/* Filtres & paramètres */}
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Rechercher une machine…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={inputStyle}
              />
              <span style={{ fontSize: 13, opacity: 0.75 }}>{selected.length} sélectionnée(s)</span>
            </div>

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Efficacité (%)</label>
                <input type="number" min={1} max={500} step={1} value={effInput} onChange={(e) => setEffInput(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Surcote (%)</label>
                <input type="number" min={0} max={500} step={1} value={extraInput} onChange={(e) => setExtraInput(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Nettoyage par pièce (min)</label>
                <input type="number" min={0} max={600} step={1} value={cleanInput} onChange={(e) => setCleanInput(e.target.value)} style={inputStyle} />
              </div>

              {/* Options calcul avancées */}
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Arrondi</label>
                <select value={roundingMode} onChange={() => {}} disabled style={inputStyle}>
                  <option value="none">Aucun (arrondi minute)</option>
                  <option value="ceil5">Au 5 min sup.</option>
                  <option value="ceil15">Au 15 min sup.</option>
                </select>
                <small style={{opacity:0.6}}>Tu peux passer la valeur via props (roundingMode)</small>
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Nettoyage</label>
                <select value={cleaningMode} onChange={() => {}} disabled style={inputStyle}>
                  <option value="per_item">Par pièce</option>
                  <option value="per_batch">Par lot (fixe)</option>
                </select>
                <small style={{opacity:0.6}}>Via props (cleaningMode/cleaningBatchMinutes)</small>
              </div>

              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Total</label>
                <select value={totalMode} onChange={() => {}} disabled style={inputStyle}>
                  <option value="sum">Somme des machines</option>
                  <option value="max">Durée critique (max)</option>
                </select>
                <small style={{opacity:0.6}}>Via props (totalMode)</small>
              </div>
            </div>
          </div>

          {/* Liste des machines */}
          <div style={{ ...panelStyle, maxHeight: 280, overflow: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {filtered.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label key={opt.value} style={cardStyle}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(opt.value)} />
                  <span>{opt.label}</span>
                </label>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: 8, fontSize: 13, opacity: 0.7 }}>Aucune machine.</div>}
          </div>

          {/* Résultats */}
          {errorText ? (
            <div style={{ color: "#c62828", fontSize: 13 }}>{errorText}</div>
          ) : (
            selected.length > 0 && (
              <div style={{ border: "1px dashed #e3e3e3", borderRadius: 10, padding: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  Durée {totalMode === "sum" ? "totale (somme)" : "critique (max)"} : {totalDurationHours.toFixed(2)} h
                </div>

                <table className="mini" style={{ width: "100%", fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Machine</th>
                      <th>Qté</th>
                      <th>Durée (h)</th>
                      <th>Durée calc. (min)</th>
                      <th>Théorique (min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perMachine.map((r) => (
                      <tr key={r.machineId}>
                        <td style={{ textAlign: "left" }}>{options.find((o) => o.value === r.machineId)?.label ?? r.machineId}</td>
                        <td style={{ textAlign: "center" }}>{r.quantity}</td>
                        <td style={{ textAlign: "center" }}>{r.durationHours.toFixed(2)}</td>
                        <td style={{ textAlign: "center" }}>{r.durationCalcMinutes}</td>
                        <td style={{ textAlign: "center" }}>{Math.round(r.durationTheoreticalMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        <div className="modal__footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose}>Annuler</button>
          <button onClick={submit} disabled={selected.length === 0 || !!errorText}>Valider</button>
        </div>
      </div>
    </div>
  );
}
