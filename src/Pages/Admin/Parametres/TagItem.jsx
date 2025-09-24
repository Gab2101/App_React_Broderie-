<<<<<<< HEAD
import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import "./TagItems.css";

/**
 * TagItem (simplifié)
 * — Élément de liste réutilisable pour un tag (label uniquement)
 * — Édition inline, accessibilité, raccourcis clavier
 */
export default function TagItem({
  tag,
  isEditing,
  editingLabel,
  onChangeLabel,
  onEdit,
  onDelete,
  onSave,
  onCancel,
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
    if (e.key === "Enter") onSave(e);
    if (e.key === "Escape") onCancel(e);
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
          <span className="tag-item-label" title={tag.label}>
            {tag.label}
          </span>

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
  }).isRequired,
  isEditing: PropTypes.bool,
  editingLabel: PropTypes.string,
  onChangeLabel: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  saving: PropTypes.bool,
};
=======
import React from "react";

export default function TagItem({
  tag,
  isEditing,
  editingValue,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditingValueChange
}) {
  if (isEditing) {
    return (
      <div className="tag-item editing">
        <input
          type="text"
          value={editingValue}
          onChange={(e) => onEditingValueChange(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") onSaveEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          autoFocus
        />
        <div className="tag-actions">
          <button onClick={onSaveEdit} className="save-btn">✓</button>
          <button onClick={onCancelEdit} className="cancel-btn">✕</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tag-item">
      <span className="tag-label">{tag.label}</span>
      <div className="tag-actions">
        <button onClick={onEdit} className="edit-btn" title="Modifier">✏️</button>
        <button onClick={onDelete} className="delete-btn" title="Supprimer">🗑️</button>
      </div>
    </div>
  );
}
>>>>>>> 569ea764f271911548a727d2b8d582a5567e7735
