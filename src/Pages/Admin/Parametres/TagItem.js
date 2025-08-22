import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import "./TagItems.css";

/**
 * TagItem
 * — Élément de liste réutilisable pour un tag (article ou broderie)
 * — Gère l'édition inline, l'accessibilité, et les raccourcis clavier
 */
export default function TagItem({
  tag,
  isEditing,
  editingLabel,
  editingCleaning,
  onChangeLabel,
  onChangeCleaning,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  showCleaning = false,
  saving = false,
}) {
  const labelRef = useRef(null);

  // Focus automatique sur l'input en mode édition
  useEffect(() => {
    if (isEditing && labelRef.current) {
      labelRef.current.focus();
      labelRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") onSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <li className={`tag-item${isEditing ? " editing" : ""}`}>      
      {isEditing ? (
        <>
          <input
            ref={labelRef}
            type="text"
            className="tag-item-input"
            aria-label="Nom du tag"
            placeholder="Nom"
            value={editingLabel}
            onChange={(e) => onChangeLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={saving}
          />

          {showCleaning && (
            <input
              type="number"
              className="tag-item-input nettoyage"
              aria-label="Temps de nettoyage (secondes)"
              placeholder="Nettoyage (s)"
              min={0}
              step={1}
              value={editingCleaning}
              onChange={(e) => onChangeCleaning(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={saving}
            />
          )}

          <button
            type="button"
            className="tag-item-button save"
            onClick={onSave}
            disabled={saving}
            aria-label="Enregistrer"
            title="Enregistrer"
          >
            💾
          </button>

          <button
            type="button"
            className="tag-item-button cancel"
            onClick={onCancel}
            disabled={saving}
            aria-label="Annuler"
            title="Annuler"
          >
            ✖
          </button>
        </>
      ) : (
        <>
          <span className="tag-item-label" title={tag.label}>{tag.label}</span>
          {showCleaning && (
            <small className="tag-item-nettoyage" title="Temps de nettoyage">
              Nettoyage: {Number(tag.nettoyage) || 0}s
            </small>
          )}
          <button
            type="button"
            className="tag-item-button edit"
            onClick={onEdit}
            aria-label="Éditer"
            title="Éditer"
          >
            ✏️
          </button>
          <button
            type="button"
            className="tag-item-button delete"
            onClick={onDelete}
            aria-label="Supprimer"
            title="Supprimer"
          >
            🗑️
          </button>
        </>
      )}
    </li>
  );
}

TagItem.propTypes = {
  tag: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    label: PropTypes.string.isRequired,
    nettoyage: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,
  isEditing: PropTypes.bool,
  editingLabel: PropTypes.string,
  editingCleaning: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChangeLabel: PropTypes.func.isRequired,
  onChangeCleaning: PropTypes.func,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  showCleaning: PropTypes.bool,
  saving: PropTypes.bool,
};
