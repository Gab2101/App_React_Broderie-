import React, { useState } from "react";
import TagItem from "./TagItem";

function ArticleTagsSection({
  articleTags,
  addArticleTag,
  updateArticleTag,
  deleteArticleTag,
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newCleaning, setNewCleaning] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingCleaning, setEditingCleaning] = useState(0);

  const handleAdd = async () => {
    if (!newLabel.trim()) {
      setError("Le nom ne peut pas être vide");
      setSuccess("");
      return;
    }

    await addArticleTag(newLabel.trim(), parseInt(newCleaning) || 0);
    setNewLabel("");
    setNewCleaning(0);
    setError("");
    setSuccess("Ajout réussi !");
    setTimeout(() => setSuccess(""), 2000);
  };

  return (
    <div className="tags-list">
      <h3>Types d'article</h3>

      {/* Formulaire d’ajout */}
      <div className="ajout-section">
        <input
          type="text"
          placeholder="Nom"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <input
          type="number"
          placeholder="Nettoyage (sec)"
          value={newCleaning}
          onChange={(e) => setNewCleaning(e.target.value)}
          style={{ width: "120px" }}
        />
        <button className="btn-enregistrer" onClick={handleAdd}>
          Ajouter
        </button>
      </div>

      {/* Affichage des messages */}
      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      {/* Champ de recherche */}
      <input
        type="text"
        placeholder="🔍 Rechercher un article..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: "10px", padding: "6px", width: "100%" }}
      />

      {/* Liste filtrée */}
      <ul>
        {articleTags
          .filter((tag) =>
            tag.label.toLowerCase().includes(search.toLowerCase())
          )
          .map((tag) => (
            <TagItem
              key={tag.id}
              tag={tag}
              isEditing={editingId === tag.id}
              editingLabel={editingLabel}
              editingCleaning={editingCleaning}
              onChangeLabel={(val) => setEditingLabel(val)}
              onChangeCleaning={(val) => setEditingCleaning(val)}
              onEdit={() => {
                setEditingId(tag.id);
                setEditingLabel(tag.label);
                setEditingCleaning(tag.nettoyage);
              }}
              onDelete={() => deleteArticleTag(tag.id)}
              onSave={async () => {
                await updateArticleTag(
                  tag.id,
                  editingLabel.trim(),
                  parseInt(editingCleaning) || 0
                );
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
              showCleaning={true}
            />
          ))}
      </ul>
    </div>
  );
}

export default ArticleTagsSection;
