import React, { useState, useRef, useEffect } from "react";
import "./MultiSelectDropdown.css";

/**
 * MultiSelectDropdown - Composant de sélection multiple avec recherche
 * 
 * Props:
 * - label: string - Libellé du champ
 * - items: Array<{label: string, value: string}> - Options disponibles
 * - selectedValues: string[] - Valeurs sélectionnées
 * - onChange: (selectedValues: string[]) => void - Callback de changement
 * - placeholder?: string - Texte d'aide
 * - searchPlaceholder?: string - Texte d'aide pour la recherche
 * - disabled?: boolean - Désactiver le composant
 */
export default function MultiSelectDropdown({
  label,
  items = [],
  selectedValues = [],
  onChange,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Filtrer les items selon la recherche
  const filteredItems = items.filter(item =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fermer le dropdown si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus sur la recherche quand on ouvre
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery("");
    }
  };

  const handleItemToggle = (value) => {
    const newSelected = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newSelected);
  };

  const handleSelectAll = () => {
    const allValues = filteredItems.map(item => item.value);
    const newSelected = [...new Set([...selectedValues, ...allValues])];
    onChange(newSelected);
  };

  const handleDeselectAll = () => {
    const filteredValues = filteredItems.map(item => item.value);
    const newSelected = selectedValues.filter(v => !filteredValues.includes(v));
    onChange(newSelected);
  };

  const selectedCount = selectedValues.length;
  const displayText = selectedCount === 0 
    ? placeholder 
    : `${selectedCount} sélectionné${selectedCount > 1 ? 's' : ''}`;

  return (
    <div className="multi-select-dropdown" ref={dropdownRef}>
      <label className="multi-select-label">
        {label}
        <div 
          className={`multi-select-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
          onClick={toggleDropdown}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleDropdown();
            }
          }}
        >
          <span className="multi-select-text">{displayText}</span>
          <span className="multi-select-arrow">▼</span>
        </div>
      </label>

      {isOpen && (
        <div className="multi-select-dropdown-content">
          <div className="multi-select-search">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="multi-select-search-input"
            />
          </div>

          {filteredItems.length > 0 && (
            <div className="multi-select-actions">
              <button
                type="button"
                onClick={handleSelectAll}
                className="multi-select-action-btn"
              >
                Tout sélectionner
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="multi-select-action-btn"
              >
                Tout désélectionner
              </button>
            </div>
          )}

          <div className="multi-select-options">
            {filteredItems.length === 0 ? (
              <div className="multi-select-no-results">Aucun résultat</div>
            ) : (
              filteredItems.map((item) => (
                <label
                  key={item.value}
                  className="multi-select-option"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(item.value)}
                    onChange={() => handleItemToggle(item.value)}
                  />
                  <span className="multi-select-option-text">{item.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}