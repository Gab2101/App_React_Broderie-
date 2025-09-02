// src/Pages/Admin/Commandes/components/CommandeCard.jsx
import React from "react";
import StatusBadge from "../../../../components/common/StatusBadge";
import { getStatusTheme } from "../../../../utils/statusTheme";
import { convertDecimalToTime } from "../../../../utils/time";
import { calculerDurees } from "../../../../utils/calculs";
import { computeNettoyageSecondsForOrder } from "../../../../utils/nettoyageRules";
import { clampPercentToStep5 } from "../utils/timeRealtime";

/**
 * Calcule automatiquement le niveau d'urgence basé sur la date de livraison
 */
const calculateUrgency = (dateLivraison) => {
  if (!dateLivraison) return 1;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const livraison = new Date(dateLivraison);
  livraison.setHours(0, 0, 0, 0);
  
  const diffTime = livraison.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 2) return 5;
  if (diffDays < 5) return 4;
  if (diffDays < 10) return 3;
  if (diffDays < 15) return 2;
  return 1;
};

/**
 * Obtient la couleur correspondant au niveau d'urgence
 */
const getUrgencyColor = (level) => {
  const urgencyColors = {
    1: "#4caf50", // Vert - Faible
    2: "#2196f3", // Bleu - Moyenne
    3: "#ff9800", // Orange - Élevée
    4: "#f44336", // Rouge - Critique
    5: "#000000", // Noir - Urgence maximale
  };
  return urgencyColors[level] || "#4caf50";
};

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
  
  // Calcul automatique de l'urgence basé sur la date de livraison
  const calculatedUrgency = calculateUrgency(cmd.dateLivraison);
  const urgencyColor = getUrgencyColor(calculatedUrgency);
  
  const getUrgencyLabel = (level) => {
    const labels = {
      1: "Faible",
      2: "Moyenne", 
      3: "Élevée",
      4: "Critique",
      5: "Urgence maximale"
    };
    return labels[level] || "Faible";
  };

  // Durées
  // Utiliser directement les valeurs stockées dans la base de données
  const b = cmd.duree_broderie_heures || 0;
  const n = cmd.duree_nettoyage_heures || 0;
  const t = cmd.duree_totale_heures || 0;

  // Calculer le coefficient affiché à partir du extra_percent stocké
  const coefAffiche = 100 + (Number(cmd.extra_percent) || 0);

  const debutLabel = cmd.started_at ? new Date(cmd.started_at).toLocaleString("fr-FR") : null;
  const finLabel = cmd.finished_at ? new Date(cmd.finished_at).toLocaleString("fr-FR") : null;

  return (
    <div
      className="carte-commande"
      style={{
        backgroundColor: theme.bgSoft,
        borderLeft: `6px solid ${theme.border}`,
        borderTop: "1px solid #e0e0e0",
        borderRight: "1px solid #e0e0e0",
        borderBottom: "1px solid #e0e0e0",
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
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderRadius: "12px",
            backgroundColor: urgencyColor,
            color: urgencyColor === "#000000" ? "#ffffff" : "#ffffff",
            fontSize: "11px",
            fontWeight: "600",
          }}
          title={`Urgence: ${getUrgencyLabel(calculatedUrgency)}`}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.8)",
            }}
          />
          {getUrgencyLabel(calculatedUrgency)}
        </div>
      </div>

      <p><strong>Client :</strong> {cmd.client}</p>
      <p><strong>Quantité :</strong> {cmd.quantite}</p>
      <p><strong>Points :</strong> {cmd.points}</p>
      <p>
        <strong>Urgence :</strong> 
        <span style={{ 
          marginLeft: "8px",
          padding: "2px 6px",
          borderRadius: "4px",
          backgroundColor: urgencyColor,
          color: urgencyColor === "#000000" ? "#ffffff" : "#ffffff",
          fontSize: "12px",
          fontWeight: "600"
        }}>
          Niveau {calculatedUrgency} - {getUrgencyLabel(calculatedUrgency)}
        </span>
      </p>
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
        }
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
