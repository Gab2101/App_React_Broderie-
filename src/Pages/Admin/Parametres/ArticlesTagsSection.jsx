import React, { useState } from "react";
import TagItem from "./TagItem";

export default function ArticlesTagsSection({
  articleTags,
  addArticleTag,
  updateArticleTag,
  deleteArticleTag
}) {
  const [newTag, setNewTag] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  const handleAdd = async () => {
    if (!newTag.trim()) return;

    const result = await addArticleTag(newTag.trim());
    if (result.ok) {
      setNewTag("");
    } else {
      alert(result.reason);
    }
  };

  const handleEdit = (tag) => {
    setEditingId(tag.id);
    setEditingValue(tag.label);
  };

  const handleSaveEdit = async () => {
    if (!editingValue.trim()) return;

    const result = await updateArticleTag(editingId, editingValue.trim());
    if (result.ok) {
      setEditingId(null);
      setEditingValue("");
    } else {
      alert(result.reason);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce tag article ?")) return;

    const result = await deleteArticleTag(id);
    if (!result.ok) {
      alert(result.reason);
    }
  };

  return (
    <section className="tags-section">
      <h3>Types d'articles</h3>

      <div className="add-tag-form">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Nouveau type d'article"
          onKeyPress={(e) => e.key === "Enter" && handleAdd()}
        />
        <button onClick={handleAdd} disabled={!newTag.trim()}>
          Ajouter
        </button>
      </div>

      <div className="tags-list">
        {articleTags.map((tag) => (
          <TagItem
            key={tag.id}
            tag={tag}
            isEditing={editingId === tag.id}
            editingValue={editingValue}
            onEdit={() => handleEdit(tag)}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onDelete={() => handleDelete(tag.id)}
            onEditingValueChange={setEditingValue}
          />
        ))}
      </div>
    </section>
  );
}
