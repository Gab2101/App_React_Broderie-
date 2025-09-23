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
      </div>
    </div>
  );
}
