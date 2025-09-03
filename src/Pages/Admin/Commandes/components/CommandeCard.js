// src/Pages/Admin/Commandes/components/CommandeCard.jsx
import React from "react";
import StatusBadge from "../../../../components/common/StatusBadge";
import { getStatusTheme } from "../../../../utils/statusTheme";
import { convertDecimalToTime } from "../../../../utils/time";
import { calculerDurees } from "../../../../utils/calculs";
import { computeNettoyageSecondsForOrder } from "../../../../utils/nettoyageRules";
import { clampPercentToStep5 } from "../utils/timeRealtime";

export default function CommandeCard({
  cmd,
  STATUTS,
  onChangeStatut,
  onEdit,
  onDelete,
  machines,
  articleTags,       // dispo si besoin futur
  nettoyageRules,    // pour fallback calcul
}) {
  const theme = getStatusTheme(cmd.statut);

  // Durées
  let b = cmd.duree_broderie_heures;
  let n = cmd.duree_nettoyage_heures;
  let t = cmd.duree_totale_heures;

  if (b == null || n == null || t == null) {
    const etiquetteArticle = cmd.types?.[0] || null;
    const nettoyageSec = computeNettoyageSecondsForOrder(
      etiquetteArticle,
      cmd.options,
      nettoyageRules,
      articleTags
    );

    const quantite = Number(cmd.quantite || 0);
    const points = Number(cmd.points || 0);
    const nbTetes = Number(machines.find((m) => m.nom === cmd.machineAssignee)?.nbTetes || 1);
    const vitessePPM = Number(cmd.vitesseMoyenne || 680);

    const calc = calculerDurees({
      quantite,
      points,
      vitesse: vitessePPM,
      nbTetes,
      nettoyageParArticleSec: nettoyageSec,
    });

    b = calc.dureeBroderieHeures;
    n = calc.dureeNettoyageHeures;
    t = calc.dureeTotaleHeures;
  }

  const theoriqueTotal = (Number(b) || 0) + (Number(n) || 0);
  const coefAffiche =
    theoriqueTotal > 0 ? clampPercentToStep5(Math.round((Number(t || 0) / theoriqueTotal) * 100)) : null;

  const debutLabel = cmd.started_at ? new Date(cmd.started_at).toLocaleString("fr-FR") : null;
  const finLabel = cmd.finished_at ? new Date(cmd.finished_at).toLocaleString("fr-FR") : null;
  
  return (
    <div
      className="carte-commande"
      style={{
        backgroundColor: theme.bgSoft,
        borderLeft: `6px solid ${theme.border}`,
        border: "1px solid #e0e0e0",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
      }}
    >
      <div
        className="carte-commande__header"
        style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}
      >
        <h3 style={{ margin: 0 }}>Commande #{cmd.numero}</h3>
        <StatusBadge statut={cmd.statut || "A commencer"} />
      </div>

      <p><strong>Client :</strong> {cmd.client}</p>
      <p><strong>Quantité :</strong> {cmd.quantite}</p>
      <p><strong>Points :</strong> {cmd.points}</p>
      <p><strong>Urgence :</strong> {cmd.urgence}</p>
      <p><strong>Livraison :</strong> {cmd.dateLivraison}</p>

      <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>Statut :</strong>{" "}
        <StatusBadge statut={cmd.statut || "A commencer"} size="sm" />
        <select
          value={cmd.statut || "A commencer"}
          onChange={(e) => onChangeStatut(cmd.id, e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${theme.border}`,
            backgroundColor: "#fff",
            color: "#333",
            outlineColor: theme.border,
          }}
        >
          {STATUTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </p>

      {debutLabel && <p><strong>Début de commande :</strong> {debutLabel}</p>}
      {finLabel && <p><strong>Fin de commande :</strong> {finLabel}</p>}

      {cmd.machineAssignee && (
        <p><strong>Machine :</strong> {cmd.machineAssignee}</p>
      )}

      {(cmd.linked_commande_id || cmd.same_machine_as_linked || cmd.start_after_linked) && (
        <div className="bloc-liaison-info">
          <strong>Liaison :</strong>{" "}
          {cmd.linked_commande_id ? `#${cmd.linked_commande_id}` : "—"} •{" "}
          {cmd.same_machine_as_linked ? "même brodeuse" : "brodeuse libre"} •{" "}
          {cmd.start_after_linked ? "enchaînée après" : "non enchaînée"}
        </div>
      )}

      <p><strong>Durée broderie (théorique) :</strong> {convertDecimalToTime(b ?? 0)}</p>
      <p><strong>Durée nettoyage (théorique) :</strong> {convertDecimalToTime(n ?? 0)}</p>
      <p>
        <strong>Durée totale (réelle appliquée) :</strong> {convertDecimalToTime(t ?? 0)}
        {coefAffiche ? <em style={{ marginLeft: 6, opacity: 0.7 }}>({coefAffiche}% appliqué)</em> : null}
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => onEdit(cmd)}
          className="btn-enregistrer"
          style={{ borderRadius: 8 }}
        >
          Modifier
        </button>
        <button
          onClick={() => onDelete(cmd.id)}
          className="btn-fermer"
          style={{ borderRadius: 8 }}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
