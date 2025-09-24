<<<<<<< HEAD
import React, { useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import TagItem from "./TagItem";
import "./TagItems.css";

/**
 * ArticlesTagsSection (simplifié)
 * — Gestion des tags d'articles (label uniquement)
 * — Ajout, édition inline, suppression, recherche, feedback
 * — Défensif contre les "submit" implicites
 */
export default function ArticlesTagsSection({
  articleTags = [],
  addArticleTag,
  updateArticleTag,
  deleteArticleTag,
}) {
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articleTags;
    return articleTags.filter((t) => t.label?.toLowerCase().includes(q));
  }, [articleTags, search]);

  const flashOk = useCallback((msg) => {
    setError("");
    setSuccess(msg);
    const id = setTimeout(() => setSuccess(""), 1500);
    return () => clearTimeout(id);
  }, []);

  const handleAdd = useCallback(async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const label = newLabel.trim();
    if (!label) {
      setError("Le nom ne peut pas être vide");
      setSuccess("");
      return;
    }

    setSaving(true);
    const res = await addArticleTag(label); // ⬅️ plus de "cleaning"
    setSaving(false);

    if (!res?.ok) {
      setError(res?.reason || "Erreur d'ajout");
      return;
    }

    setNewLabel("");
    flashOk("Ajout réussi !");
  }, [newLabel, addArticleTag, flashOk]);

  // Wrappers "défensifs"
  const onEditWrap = useCallback((tag) => (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setEditingId(tag.id);
    setEditingLabel(tag.label);
    setError("");
  }, []);

  const onDeleteWrap = useCallback((tag) => async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    await deleteArticleTag(tag.id);
  }, [deleteArticleTag]);

  const onSaveWrap = useCallback((tag) => async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const label = editingLabel.trim();
    if (!label) return setError("Le nom ne peut pas être vide");

    setSaving(true);
    const res = await updateArticleTag(tag.id, label); // ⬅️ plus de "cleaning"
    setSaving(false);

    if (!res?.ok) return setError(res?.reason || "Erreur de mise à jour");
    setEditingId(null);
    flashOk("Modifié ✓");
  }, [editingLabel, updateArticleTag, flashOk]);

  const onCancelWrap = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setEditingId(null);
  }, []);

  return (
    <div className="tags-list" aria-live="polite">
      <h3>Étiquettes d'articles</h3>

      {/* Ajout */}
      <div className="ajout-section">
        <input
          type="text"
          placeholder="Nom de l'étiquette"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          aria-label="Nom de l'étiquette d'article"
          disabled={saving}
        />
        <button
          className="btn-enregistrer"
          type="button"              // ✅ empêche submit implicite
          onClick={handleAdd}
          disabled={saving}
        >
=======
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
>>>>>>> 569ea764f271911548a727d2b8d582a5567e7735
          Ajouter
        </button>
      </div>

<<<<<<< HEAD
      {/* Feedback */}
      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      {/* Recherche */}
      <input
        type="text"
        placeholder="🔍 Rechercher une étiquette..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 10, padding: 6, width: "100%" }}
        aria-label="Rechercher une étiquette d'article"
      />

      {/* Liste */}
      <ul>
        {filtered.map((tag) => (
=======
      <div className="tags-list">
        {articleTags.map((tag) => (
>>>>>>> 569ea764f271911548a727d2b8d582a5567e7735
          <TagItem
            key={tag.id}
            tag={tag}
            isEditing={editingId === tag.id}
<<<<<<< HEAD
            editingLabel={editingLabel}
            onChangeLabel={setEditingLabel}
            onEdit={onEditWrap(tag)}
            onDelete={onDeleteWrap(tag)}
            onSave={onSaveWrap(tag)}
            onCancel={onCancelWrap}
            saving={saving}
            // ⛔️ plus de props liés au nettoyage
          />
        ))}
      </ul>
    </div>
  );
}

ArticlesTagsSection.propTypes = {
  articleTags: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.string,
      // ⛔️ plus de "nettoyage"
    })
  ),
  addArticleTag: PropTypes.func.isRequired,     // (label) => { ok, reason? }
  updateArticleTag: PropTypes.func.isRequired,  // (id, label) => { ok, reason? }
  deleteArticleTag: PropTypes.func.isRequired,  // (id) => { ok, reason? }
};
=======
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
>>>>>>> 569ea764f271911548a727d2b8d582a5567e7735
