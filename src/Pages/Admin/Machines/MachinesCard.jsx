import React from "react";

export default function MachinesCard({ machine, onEdit, onDelete }) {
  return (
    <div className="machine-card">
      <div className="machine-card__header">
        <h3>{machine.nom}</h3>
        <div className="machine-card__actions">
          <button onClick={() => onEdit(machine)}>Modifier</button>
          <button onClick={() => onDelete(machine.id)}>Supprimer</button>
        </div>
      </div>

      <div className="machine-card__content">
        <p><strong>Type :</strong> {machine.type || "—"}</p>
        <p><strong>Capacité :</strong> {machine.capacite || "—"}</p>
        <p><strong>État :</strong> {machine.etat || "—"}</p>
        {machine.description && <p><strong>Description :</strong> {machine.description}</p>}
      </div>
    </div>
  );
}
