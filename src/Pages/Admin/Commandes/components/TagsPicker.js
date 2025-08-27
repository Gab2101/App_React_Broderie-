// src/Pages/Admin/Commandes/components/TagsPicker.jsx
import React from "react";

/**
 * TagsPicker
 * @param {Object[]} items - Liste des tags à afficher. Chaque item doit avoir au moins { label, id? }.
 * @param {string[]} selected - Liste des labels sélectionnés.
 * @param {(label: string) => void} onToggle - Callback quand on clique un tag.
 * @param {string} className - Classes CSS optionnelles pour le conteneur.
 * @param {("button"|"pill")} variant - Style visuel ("button" par défaut).
 */
export default function TagsPicker({
  items = [],
  selected = [],
  onToggle,
  className = "",
  variant = "button",
}) {
  return (
    <div className={`tags-container ${className}`}>
      {Array.isArray(items) &&
        items.map((tag) => {
          const key = tag.id ?? tag.label;
          const isActive = selected.includes(tag.label);
          const base =
            variant === "pill"
              ? "tag-pill"
              : "tag";

          return (
            <button
              key={key}
              type="button"
              className={`${base} ${isActive ? "active" : ""}`}
              onClick={() => onToggle(tag.label)}
              title={tag.label}
            >
              {tag.label}
            </button>
          );
        })}
    </div>
  );
}
