import React, { useState, useEffect } from "react";

export default function MachinesForm({ machine, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    nom: "",
    type: "",
    capacite: "",
    etat: "active",
    description: ""
  });

  useEffect(() => {
    if (machine) {
      setFormData({
        nom: machine.nom || "",
        type: machine.type || "",
        capacite: machine.capacite || "",
        etat: machine.etat || "active",
        description: machine.description || ""
      });
    } else {
      setFormData({
        nom: "",
        type: "",
        capacite: "",
        etat: "active",
        description: ""
      });
    }
  }, [machine]);

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
  };

  return (
    <div className="machine-form">
      <h3>{machine ? "Modifier la machine" : "Nouvelle machine"}</h3>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="nom">Nom :</label>
          <input
            type="text"
            id="nom"
            name="nom"
            value={formData.nom}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="type">Type :</label>
          <input
            type="text"
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="capacite">Capacité :</label>
          <input
            type="text"
            id="capacite"
            name="capacite"
            value={formData.capacite}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="etat">État :</label>
          <select
            id="etat"
            name="etat"
            value={formData.etat}
            onChange={handleChange}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description :</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
          />
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel}>Annuler</button>
          <button type="submit">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}
