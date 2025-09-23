import React, { useState } from "react";
import TagItem from "./TagItem";

export default function BroderieTagsSection({
  broderieTags,
  addBroderieTag,
  updateBroderieTag,
  deleteBroderieTag
}) {
  const [newTag, setNewTag] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  const handleAdd = async () => {
    if (!newTag.trim()) return;

    const result = await addBroderieTag(newTag.trim());
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

    const result = await updateBroderieTag(editingId, editingValue.trim());
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
    if (!confirm("Supprimer ce tag broderie ?")) return;

    const result = await deleteBroderieTag(id);
    if (!result.ok) {
      alert(result.reason);
    }
  };

  return (
    <section className="tags-section">
      <h3>Zones de broderie</h3>

      <div className="add-tag-form">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Nouvelle zone de broderie"
          onKeyPress={(e) => e.key === "Enter" && handleAdd()}
        />
        <button onClick={handleAdd} disabled={!newTag.trim()}>
          Ajouter
        </button>
      </div>

      <div className="tags-list">
        {broderieTags.map((tag) => (
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
