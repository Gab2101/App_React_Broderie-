// src/Pages/Admin/Commandes/components/TagsPicker.jsx
import { memo, useMemo } from "react";

/**
 * TagsPicker
 * @param {Object[]} items - Liste des tags: { label: string, id?: string|number }.
 * @param {string[]|Set<string>} selected - Liste/Set des labels sélectionnés.
 * @param {(label: string) => void} onToggle - Callback au clic.
 * @param {string} className - Classes CSS optionnelles pour le conteneur.
 * @param {("button"|"pill")} variant - Style visuel ("button" par défaut).
 * @param {boolean} disabled - Désactive tous les boutons.
 * @param {boolean} readOnly - Visuel actif mais sans interaction.
 */

const norm = (s) =>
  (typeof s === "string" ? s : String(s ?? "")).trim().toLowerCase();

const toSelectedSet = (sel) => {
  if (sel instanceof Set) return new Set(Array.from(sel).map(norm));
  if (Array.isArray(sel)) return new Set(sel.map(norm));
  return new Set();
};

const slugify = (s) => norm(s).replace(/\s+/g, "-");

function TagsPicker({
  items = [],
  selected = [],
  onToggle = () => {},
  className = "",
  variant = "button",
  disabled = false,
  readOnly = false,
}) {
  const selectedSet = useMemo(() => toSelectedSet(selected), [selected]);
  const canInteract = !(disabled || readOnly);

  return (
    <div className={`tags-container${className ? " " + className : ""}`}>
      {Array.isArray(items) &&
        items.map((tag, idx) => {
          const label = tag?.label ?? "";
          const key = tag?.id ?? `tag-${slugify(label)}-${idx}`;
          const isActive = selectedSet.has(norm(label));
          const base = variant === "pill" ? "tag-pill" : "tag";

          return (
            <button
              key={key}
              type="button"
              className={`${base} ${isActive ? "active" : ""}`}
              onClick={() => {
                if (!canInteract) return;
                onToggle(label);
              }}
              title={label}
              aria-pressed={isActive}
              aria-label={label}
              disabled={disabled}
              data-selected={isActive ? "true" : "false"}
              data-variant={variant}
            >
              {label}
            </button>
          );
        })}
    </div>
  );
}

export default memo(TagsPicker);
