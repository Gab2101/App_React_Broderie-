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
      formData?.nbTetes !== "" &&
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
          placeholder="Ex. TMBP‑S1501C #1"
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
