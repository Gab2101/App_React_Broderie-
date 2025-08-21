import React, { useState } from "react";
import TagItem from "./TagItem";

function BroderieTagsSection({
  broderieTags,
  addBroderieTag,
  updateBroderieTag,
  deleteBroderieTag,
}) {
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const handleAdd = async () => {
    if (!newLabel.trim()) {
      setError("Le nom ne peut pas être vide");
      setSuccess("");
      return;
    }
    await addBroderieTag(newLabel.trim());
    setNewLabel("");
    setError("");
    setSuccess("Ajout réussi !");
    setTimeout(() => setSuccess(""), 2000);
  };

  return (
    // ➜ même conteneur/classe que ArticlesTagsSection
    <div className="tags-list">
      <h3>Options de broderie</h3>

      {/* Formulaire d’ajout (mêmes classes) */}
      <div className="ajout-section">
        <input
          type="text"
          placeholder="Nom de l'option"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <button className="btn-enregistrer" onClick={handleAdd}>
          Ajouter
        </button>
      </div>

      {/* Feedback (mêmes classes) */}
      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      {/* Recherche (mêmes styles/placeholder) */}
      <input
        type="text"
        placeholder="🔍 Rechercher une option de broderie..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: "10px", padding: "6px", width: "100%" }}
      />

      {/* Liste (même structure) */}
      <ul>
        {broderieTags
          .filter((t) => t.label.toLowerCase().includes(search.toLowerCase()))
          .map((tag) => (
            <TagItem
              key={tag.id}
              tag={tag}
              isEditing={editingId === tag.id}
              editingLabel={editingLabel}
              onChangeLabel={setEditingLabel}
              onEdit={() => {
                setEditingId(tag.id);
                setEditingLabel(tag.label);
              }}
              onDelete={() => deleteBroderieTag(tag.id)}
              onSave={async () => {
                await updateBroderieTag(tag.id, editingLabel.trim());
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
              // ➜ pas de champ nettoyage ici
              showCleaning={false}
            />
          ))}
      </ul>
    </div>
  );
}

export default BroderieTagsSection;
