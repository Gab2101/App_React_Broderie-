import React from "react";

function MachineForm({
  formData,
  articleTags,
  broderieTags,
  onChange,
  onSubmit,
  onCancel,
  toggleTag,
  isEditing
}) {
  return (
    <form onSubmit={onSubmit} className="formulaire-machine">
      <h2>{isEditing ? `Modifier ${formData.nom}` : "Nouvelle machine"}</h2>

      <label>
        Nom :
        <input
          type="text"
          name="nom"
          value={formData.nom}
          onChange={onChange}
          required
        />
      </label>

      <label>
        Nombre de têtes :
        <select
          name="nbTetes"
          value={formData.nbTetes}
          onChange={onChange}
          required
        >
          <option value="">-- Sélectionner --</option>
          {[1, 2, 4, 6, 8, 12, 15, 18, 20].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <label>Étiquettes :</label>
      <div className="tags-container">
        {[...articleTags, ...broderieTags].map((tag) => (
          <button
            key={tag.label || tag}
            type="button"
            className={`tag ${
              formData.etiquettes.includes(tag.label || tag) ? "active" : ""
            }`}
            onClick={() => toggleTag(tag.label || tag)}
          >
            {tag.label || tag}
          </button>
        ))}
      </div>

      <div className="btn-zone">
        <button type="submit" className="btn-enregistrer">
          Enregistrer
        </button>
        <button type="button" className="btn-fermer" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export default MachineForm;
