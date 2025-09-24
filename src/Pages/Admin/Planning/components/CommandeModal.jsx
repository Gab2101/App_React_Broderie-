<<<<<<< HEAD
// src/Pages/Admin/Planning/components/CommandeModal.jsx
import React from "react";

const PARIS_TZ = "Europe/Paris";

export default function CommandeModal({
  commande,
  onClose,
  onOptimisticReplace,
  onTermineeShortenPlanning,
  updateCommandeStatut,
  allowedStatuts = ["A commencer", "En cours", "Terminée"],
}) {
  const [statut, setStatut] = React.useState(commande?.statut ?? "A commencer");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setStatut(commande?.statut ?? "A commencer");
  }, [commande?.id, commande?.statut]);

  const handleSave = async () => {
    if (!commande?.id) return;

    // Rien à faire si aucun changement
    if ((commande.statut ?? "A commencer") === statut) {
      onClose?.();
      return;
    }

    setSaving(true);
    setError("");

    const optimistic = { ...commande, statut };
    onOptimisticReplace?.(optimistic);

    try {
      const saved = await updateCommandeStatut(commande.id, statut);
      onOptimisticReplace?.(saved);

      // Si "Terminée" → coupe à l'heure pleine suivante côté planning (Paris)
      if (statut === "Terminée") {
        await onTermineeShortenPlanning?.(commande.id, new Date());
      }
      onClose?.();
    } catch (e) {
      onOptimisticReplace?.(commande);
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  if (!commande) return null;

  return (
    <div
      className="modal-overlay"
      onClick={!saving ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`cmd-title-${commande.id}`}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 id={`cmd-title-${commande.id}`}>Commande #{commande.numero}</h3>
        <p><strong>Client :</strong> {commande.client}</p>
        <p>
          <strong>Date de livraison :</strong>{" "}
          {commande.dateLivraison
            ? new Date(commande.dateLivraison).toLocaleDateString("fr-FR", {
                timeZone: PARIS_TZ,
              })
            : "—"}
        </p>

        <label className="field" style={{ display: "block", marginTop: 12 }}>
          <span style={{ display: "block", marginBottom: 6 }}>
            <strong>Statut</strong>
          </span>
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
            disabled={saving}
          >
            {allowedStatuts.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {error && (
          <div className="error" role="alert" style={{ marginTop: 8 }}>
            {error}
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={saving}>Fermer</button>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
=======
import React, { useState, useEffect } from "react";

export default function CommandeModal({ isOpen, onClose, commande, onSave }) {
  const [formData, setFormData] = useState({
    numero: "",
    client: "",
    quantite: "",
    points: "",
    statut: "A commencer"
  });

  useEffect(() => {
    if (commande) {
      setFormData({
        numero: commande.numero || "",
        client: commande.client || "",
        quantite: commande.quantite || "",
        points: commande.points || "",
        statut: commande.statut || "A commencer"
      });
    }
  }, [commande]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{commande ? "Modifier la commande" : "Nouvelle commande"}</h3>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="numero">Numéro :</label>
            <input
              type="text"
              id="numero"
              name="numero"
              value={formData.numero}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="client">Client :</label>
            <input
              type="text"
              id="client"
              name="client"
              value={formData.client}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="quantite">Quantité :</label>
            <input
              type="number"
              id="quantite"
              name="quantite"
              value={formData.quantite}
              onChange={handleChange}
              min="1"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="points">Points :</label>
            <input
              type="number"
              id="points"
              name="points"
              value={formData.points}
              onChange={handleChange}
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="statut">Statut :</label>
            <select
              id="statut"
              name="statut"
              value={formData.statut}
              onChange={handleChange}
            >
              <option value="A commencer">À commencer</option>
              <option value="En cours">En cours</option>
              <option value="Terminé">Terminé</option>
              <option value="Annulé">Annulé</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Annuler</button>
            <button type="submit">Enregistrer</button>
          </div>
        </form>
>>>>>>> 569ea764f271911548a727d2b8d582a5567e7735
      </div>
    </div>
  );
}
