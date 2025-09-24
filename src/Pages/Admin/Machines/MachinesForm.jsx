<<<<<<< HEAD
import React, { useMemo } from "react";
import PropTypes from "prop-types";

function MachinesForm({
  formData,
  articleTags = [],
  broderieTags = [],
  onChange,
  onSubmit,
  onCancel,
  toggleTag,
  isEditing,
}) {
  const isValid = useMemo(() => {
    const nameOk = String(formData?.nom ?? "").trim().length > 0;
    const headsOk =
      formData?.nbTetes === "" || // autorise vide → sera NULL
      !Number.isNaN(parseInt(formData?.nbTetes, 10));
    return nameOk && headsOk;
  }, [formData]);

  return (
    <form
      onSubmit={onSubmit}
      className="formulaire-machine"
      aria-label={isEditing ? "Modifier machine" : "Nouvelle machine"}
    >
      <h2>{isEditing ? `Modifier ${formData.nom || ""}` : "Nouvelle machine"}</h2>

      <label>
        Nom :
        <input
          type="text"
          name="nom"
          value={formData.nom}
          onChange={onChange}
          required
          autoFocus
          placeholder="Ex. TMBP-S1501C #1"
        />
      </label>

      <label>
        Nombre de têtes :
        <select
          name="nbTetes"
          value={formData.nbTetes}
          onChange={onChange}
          required
          aria-invalid={formData.nbTetes === ""}
        >
          <option value="">-- Sélectionner --</option>
          {[1, 2, 4, 6, 8, 12, 15, 18, 20].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {/* Groupe machines (label libre) */}
      <div className="field">
        <label>Groupe (label)</label>
        <input
          type="text"
          name="group_label"
          value={formData.group_label || ""}
          onChange={onChange}
          placeholder="Rose / Verte Orange / Verte grise / Verte"
        />
      </div>

      {/* Étiquettes */}
      <label>Étiquettes :</label>

      {/* Groupe Articles */}
      <div className="tags-section">
        <p className="tags-title">Articles :</p>
        <div className="tags-container">
          {articleTags.length > 0 ? (
            articleTags.map((tag) => (
              <button
                key={tag.label}
                type="button"
                className={`tag ${
                  (formData.etiquettes || []).includes(tag.label) ? "active" : ""
                }`}
                onClick={() => toggleTag(tag.label)}
              >
                {tag.label}
              </button>
            ))
          ) : (
            <span className="muted">Aucun article disponible</span>
          )}
        </div>
      </div>

      {/* Groupe Broderie */}
      <div className="tags-section">
        <p className="tags-title">Options de broderie :</p>
        <div className="tags-container">
          {broderieTags.length > 0 ? (
            broderieTags.map((tag) => (
              <button
                key={tag.label}
                type="button"
                className={`tag ${
                  (formData.etiquettes || []).includes(tag.label) ? "active" : ""
                }`}
                onClick={() => toggleTag(tag.label)}
              >
                {tag.label}
              </button>
            ))
          ) : (
            <span className="muted">Aucune option disponible</span>
          )}
        </div>
      </div>

      <div className="btn-zone">
        <button
          type="submit"
          className="btn-enregistrer"
          disabled={!isValid}
          title={!isValid ? "Compléter les champs requis" : "Enregistrer"}
        >
          Enregistrer
        </button>
        <button type="button" className="btn-fermer" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}

MachinesForm.propTypes = {
  formData: PropTypes.shape({
    nom: PropTypes.string,
    nbTetes: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    etiquettes: PropTypes.arrayOf(PropTypes.string),
    group_label: PropTypes.string,            // ✅ ajouté
  }).isRequired,
  articleTags: PropTypes.array,
  broderieTags: PropTypes.array,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  toggleTag: PropTypes.func.isRequired,
  isEditing: PropTypes.bool,
};

export default MachinesForm;
=======
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
>>>>>>> 569ea764f271911548a727d2b8d582a5567e7735
