import React from "react";
import "./TagItems.css";

function TagItem({
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
}) {
  return (
    <li className="tag-item">
      {isEditing ? (
        <>
          <input
            type="text"
            value={editingLabel}
            onChange={(e) => onChangeLabel(e.target.value)}
            className="tag-item-input"
          />
          {showCleaning && (
            <input
              type="number"
              value={editingCleaning}
              onChange={(e) => onChangeCleaning(e.target.value)}
              className="tag-item-input nettoyage"
            />
          )}
          <button onClick={onSave} className="tag-item-button">💾</button>
          <button onClick={onCancel} className="tag-item-button">✖</button>
        </>
      ) : (
        <>
          <span className="tag-item-label">{tag.label}</span>
          {showCleaning && (
            <small className="tag-item-nettoyage">
              Nettoyage: {tag.nettoyage}s
            </small>
          )}
          <button onClick={onEdit} className="tag-item-button">✏️</button>
          <button onClick={onDelete} className="tag-item-button">🗑️</button>
        </>
      )}
    </li>
  );
}

export default TagItem;
