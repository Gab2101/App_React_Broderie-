import React, { useMemo } from "react";
import PropTypes from "prop-types";
import MultiSelectDropdown from "../../../components/common/MultiSelectDropdown";

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

  // Préparer les items pour les dropdowns
  const articleItems = useMemo(() => 
    articleTags.map(tag => ({ label: tag.label, value: tag.label })),
    [articleTags]
  );

  const broderieItems = useMemo(() => 
    broderieTags.map(tag => ({ label: tag.label, value: tag.label })),
    [broderieTags]
  );

  const handleEtiquettesChange = (selectedLabels) => {
    // Remplacer complètement les étiquettes par la nouvelle sélection
    const event = {
      target: {
        name: 'etiquettes',
        value: selectedLabels
      }
    };
    // Simuler un changement de champ pour maintenir la compatibilité
    onChange(event);
  };
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

      <MultiSelectDropdown
        label="Articles :"
        items={articleItems}
        selectedValues={(formData.etiquettes || []).filter(label => 
          articleTags.some(tag => tag.label === label)
        )}
        onChange={(selectedArticles) => {
          const currentBroderies = (formData.etiquettes || []).filter(label => 
            broderieTags.some(tag => tag.label === label)
          );
          handleEtiquettesChange([...selectedArticles, ...currentBroderies]);
        }}
        placeholder="Sélectionner des articles..."
        searchPlaceholder="Rechercher un article..."
      />

      <MultiSelectDropdown
        label="Options de broderie :"
        items={broderieItems}
        selectedValues={(formData.etiquettes || []).filter(label => 
          broderieTags.some(tag => tag.label === label)
        )}
        onChange={(selectedBroderies) => {
          const currentArticles = (formData.etiquettes || []).filter(label => 
            articleTags.some(tag => tag.label === label)
          );
          handleEtiquettesChange([...currentArticles, ...selectedBroderies]);
        }}
        placeholder="Sélectionner des options..."
        searchPlaceholder="Rechercher une option..."
      />

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
