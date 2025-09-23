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
