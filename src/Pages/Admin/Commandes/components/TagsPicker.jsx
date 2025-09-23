import React from "react";

/**
 * TagsPicker – composant réutilisable pour sélectionner des tags.
 *
 * @param {Object[]} items - Liste des tags: { label: string, id?: string|number }.
 * @param {string[]|Set<string>} selected - Liste/Set des labels sélectionnés.
 * @param {(label: string) => void} onToggle - Callback au clic.
 * @param {string} className - Classes CSS additionnelles.
 */
export function TagsPicker({ items, selected, onToggle, className = "" }) {
  const isSelected = (label) => {
    if (Array.isArray(selected)) return selected.includes(label);
    if (selected instanceof Set) return selected.has(label);
    return false;
  };

  return (
    <div className={`tags-container${className ? " " + className : ""}`}>
      {Array.isArray(items) &&
        items.map((item, index) => {
          const key = item.id || item.label || index;
          const isActive = isSelected(item.label);

          return (
            <button
              key={key}
              type="button"
              className={`tag-item ${isActive ? "active" : ""}`}
              onClick={() => onToggle(item.label)}
              title={isActive ? "Retirer" : "Ajouter"}
            >
              {item.label}
            </button>
          );
        })}
    </div>
  );
}

export default TagsPicker;
