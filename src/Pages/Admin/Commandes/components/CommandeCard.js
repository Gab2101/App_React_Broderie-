// src/Pages/Admin/Commandes/components/CommandeCard.js
import React from "react";
import StatusBadge from "../../../../components/common/StatusBadge";

export default function CommandeCard({
  cmd,
  STATUTS,
  onChangeStatut,
  onEdit,
  onDelete,
  machines = [],
  articleTags = [],
  nettoyageRules = [],
}) {
  if (!cmd) return null;

  // Utilisation directe des valeurs stockées en base
  const b = cmd.duree_broderie_heures;
  const n = cmd.duree_nettoyage_heures;
  const t = cmd.duree_totale_heures;

  // Calcul du coefficient affiché basé sur la durée théorique vs réelle
  const theoriqueTotal = (Number(b) || 0) + (Number(n) || 0);
  const reelleTotal = Number(t) || 0;
  const coefAffiche = theoriqueTotal > 0 ? Math.round((reelleTotal / theoriqueTotal) * 100) : 100;

  const handleStatutChange = (e) => {
    const newStatut = e.target.value;
    if (newStatut !== cmd.statut) {
      onChangeStatut(cmd.id, newStatut);
    }
  };

  return (
    <div className="commande-card">
      <div className="commande-header">
        <h3>#{cmd.numero}</h3>
        <StatusBadge statut={cmd.statut} />
      </div>

      <div className="commande-details">
        <p><strong>Client :</strong> {cmd.client}</p>
        <p><strong>Quantité :</strong> {cmd.quantite}</p>
        <p><strong>Points :</strong> {cmd.points}</p>
        
        {cmd.dateLivraison && (
          <p><strong>Livraison :</strong> {new Date(cmd.dateLivraison).toLocaleDateString("fr-FR")}</p>
        )}

        {cmd.urgence && (
          <p><strong>Urgence :</strong> {cmd.urgence}/5</p>
        )}

        {/* Affichage des durées */}
        <div className="durees-section">
          {b != null && <p><strong>Durée broderie :</strong> {Number(b).toFixed(2)}h</p>}
          {n != null && <p><strong>Durée nettoyage :</strong> {Number(n).toFixed(2)}h</p>}
          {t != null && (
            <p><strong>Durée totale (réelle appliquée) :</strong> {Number(t).toFixed(2)}h</p>
          )}
          {coefAffiche !== 100 && (
            <p><strong>Coefficient appliqué :</strong> {coefAffiche}%</p>
          )}
        </div>

        {/* Types et options */}
        {cmd.types && cmd.types.length > 0 && (
          <div className="tags-section">
            <strong>Types :</strong>
            <div className="tag-list">
              {cmd.types.map((type, i) => (
                <span key={i} className="tag">{type}</span>
              ))}
            </div>
          </div>
        )}

        {cmd.options && cmd.options.length > 0 && (
          <div className="tags-section">
            <strong>Options :</strong>
            <div className="tag-list">
              {cmd.options.map((option, i) => (
                <span key={i} className="tag">{option}</span>
              ))}
            </div>
          </div>
        )}

        {/* Machine assignée */}
        {cmd.machineAssignee && (
          <p><strong>Machine :</strong> {cmd.machineAssignee}</p>
        )}

        {/* Liaison */}
        {cmd.linked_commande_id && (
          <p><strong>Liée à :</strong> Commande #{cmd.linked_commande_id}</p>
        )}
      </div>

      <div className="commande-actions">
        <select value={cmd.statut} onChange={handleStatutChange}>
          {STATUTS.map((statut) => (
            <option key={statut} value={statut}>
              {statut}
            </option>
          ))}
        </select>

        <button onClick={() => onEdit(cmd)} className="btn-edit">
          Modifier
        </button>

        <button onClick={() => onDelete(cmd.id)} className="btn-delete">
          Supprimer
        </button>
      </div>
    </div>
  );
}