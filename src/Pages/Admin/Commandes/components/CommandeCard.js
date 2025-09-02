// src/Pages/Admin/Commandes/components/CommandeCard.js
import React from "react";
import StatusBadge from "../../../../components/common/StatusBadge";

/* ---------- Helpers locaux (anti-crash & affichage) ---------- */
const toArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

// Affiche 2 décimales OU HH:MM selon besoin (garde simple → deux décimales ici)
const fmtHours = (h) => {
  const n = Number(h);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}h`;
};

// Coef appliqué = (réel/théorique)*100 arrondi à l'entier
const computeCoef = (theoHours, realHours) => {
  const t = Number(theoHours) || 0;
  const r = Number(realHours) || 0;
  if (t <= 0) return null;
  return Math.round((r / t) * 100);
};

export default function CommandeCard({
  cmd,
  STATUTS = [],
  onChangeStatut,
  onEdit,
  onDelete,
  machines = [],
  articleTags = [],
  nettoyageRules = [],
}) {
  if (!cmd) return null;

  // Normalisations défensives (certaines anciennes lignes DB ont des strings)
  const typesArr = toArray(cmd.types);
  const optionsArr = toArray(cmd.options);

  // Durées stockées (heures décimales en base)
  const dureeBroderieH   = cmd.duree_broderie_heures;
  const dureeNettoyageH  = cmd.duree_nettoyage_heures;
  const dureeTotaleH     = cmd.duree_totale_heures;

  const theoTotalH = (Number(dureeBroderieH) || 0) + (Number(dureeNettoyageH) || 0);
  const coefAffiche = computeCoef(theoTotalH, dureeTotaleH); // null si non calculable

  // Labels date/heure
  const livraisonLabel = cmd.dateLivraison
    ? new Date(cmd.dateLivraison).toLocaleDateString("fr-FR")
    : null;
  const startedLabel = cmd.started_at
    ? new Date(cmd.started_at).toLocaleString("fr-FR")
    : null;
  const finishedLabel = cmd.finished_at
    ? new Date(cmd.finished_at).toLocaleString("fr-FR")
    : null;

  const handleStatutChange = (e) => {
    const next = e.target.value;
    if (next !== cmd.statut) onChangeStatut?.(cmd.id, next);
  };

  return (
    <div
      className="commande-card"
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header */}
      <div
        className="commande-header"
        style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}
      >
        <h3 style={{ margin: 0 }}>Commande #{cmd.numero}</h3>
        <StatusBadge statut={cmd.statut || "A commencer"} />
      </div>

      {/* Détails principaux */}
      <div className="commande-details" style={{ display: "grid", gap: 6 }}>
        <p><strong>Client :</strong> {cmd.client || "—"}</p>
        <p><strong>Quantité :</strong> {cmd.quantite ?? "—"}</p>
        <p><strong>Points :</strong> {cmd.points ?? "—"}</p>

        {livraisonLabel && <p><strong>Livraison :</strong> {livraisonLabel}</p>}
        {cmd.urgence != null && <p><strong>Urgence :</strong> {cmd.urgence}/5</p>}

        {/* Durées */}
        <div className="durees-section" style={{ display: "grid", gap: 2 }}>
          {dureeBroderieH != null && (
            <p><strong>Durée broderie :</strong> {fmtHours(dureeBroderieH)}</p>
          )}
          {dureeNettoyageH != null && (
            <p><strong>Durée nettoyage :</strong> {fmtHours(dureeNettoyageH)}</p>
          )}
          {dureeTotaleH != null && (
            <p><strong>Durée totale (réelle appliquée) :</strong> {fmtHours(dureeTotaleH)}</p>
          )}
          {coefAffiche != null && coefAffiche !== 100 && (
            <p><strong>Coefficient appliqué :</strong> {coefAffiche}%</p>
          )}
        </div>

        {/* Types & Options */}
        {typesArr.length > 0 && (
          <div className="tags-section" style={{ marginTop: 6 }}>
            <strong>Types :</strong>
            <div className="tag-list" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {typesArr.map((type, i) => (
                <span key={i} className="tag" style={{ padding: "4px 8px", borderRadius: 8, background: "#f3f4f6", fontSize: 12 }}>
                  {String(type)}
                </span>
              ))}
            </div>
          </div>
        )}

        {optionsArr.length > 0 && (
          <div className="tags-section" style={{ marginTop: 6 }}>
            <strong>Options :</strong>
            <div className="tag-list" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {optionsArr.map((opt, i) => (
                <span key={i} className="tag" style={{ padding: "4px 8px", borderRadius: 8, background: "#eef2ff", fontSize: 12 }}>
                  {String(opt)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Machine & Liaison */}
        {cmd.machineAssignee && <p><strong>Machine :</strong> {cmd.machineAssignee}</p>}

        {(cmd.linked_commande_id || cmd.same_machine_as_linked || cmd.start_after_linked) && (
          <div className="bloc-liaison-info" style={{ fontSize: 13, opacity: 0.85 }}>
            <strong>Liaison :</strong>{" "}
            {cmd.linked_commande_id ? `#${cmd.linked_commande_id}` : "—"} •{" "}
            {cmd.same_machine_as_linked ? "même brodeuse" : "brodeuse libre"} •{" "}
            {cmd.start_after_linked ? "enchaînée après" : "non enchaînée"}
          </div>
        )}

        {/* Timestamps */}
        {startedLabel && <p><strong>Début :</strong> {startedLabel}</p>}
        {finishedLabel && <p><strong>Fin :</strong> {finishedLabel}</p>}
      </div>

      {/* Actions */}
      <div
        className="commande-actions"
        style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}
      >
        <select
          value={cmd.statut || "A commencer"}
          onChange={handleStatutChange}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
            outline: "none",
          }}
        >
          {STATUTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button onClick={() => onEdit?.(cmd)} className="btn-edit" style={{ borderRadius: 8 }}>
          Modifier
        </button>
        <button onClick={() => onDelete?.(cmd.id)} className="btn-delete" style={{ borderRadius: 8 }}>
          Supprimer
        </button>
      </div>
    </div>
  );
}
