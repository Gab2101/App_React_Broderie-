import React, { useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import TagItem from "./TagItem";
import "./TagItems.css";

/**
 * ArticlesTagsSection
 * — Gestion des tags d'articles (label + nettoyage en secondes)
 * — Ajout, édition inline, suppression, recherche, feedback
 * — Défensif contre les "submit" implicites (e.preventDefault sur actions)
 */
export default function ArticlesTagsSection({
  articleTags = [],
  addArticleTag,
  updateArticleTag,
  deleteArticleTag,
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newCleaning, setNewCleaning] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingCleaning, setEditingCleaning] = useState(0);
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
    const cleaning = Number(newCleaning) || 0;

    if (!label) {
      setError("Le nom ne peut pas être vide");
      setSuccess("");
      return;
    }
    if (cleaning < 0) {
      setError("Le nettoyage doit être ≥ 0");
      setSuccess("");
      return;
    }

    setSaving(true);
    const res = await addArticleTag(label, cleaning);
    setSaving(false);

    if (!res?.ok) {
      setError(res?.reason || "Erreur d'ajout");
      return;
    }

    setNewLabel("");
    setNewCleaning(0);
    flashOk("Ajout réussi !");
  }, [newLabel, newCleaning, addArticleTag, flashOk]);

  // Wrappers "défensifs" : empêchent un submit implicite si TagItem est dans un <form>
  const onEditWrap = useCallback((tag) => (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setEditingId(tag.id);
    setEditingLabel(tag.label);
    setEditingCleaning(Number(tag.nettoyage) || 0);
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
    const cleaning = Number(editingCleaning) || 0;

    if (!label) return setError("Le nom ne peut pas être vide");
    if (cleaning < 0) return setError("Le nettoyage doit être ≥ 0");

    setSaving(true);
    const res = await updateArticleTag(tag.id, label, cleaning);
    setSaving(false);

    if (!res?.ok) return setError(res?.reason || "Erreur de mise à jour");
    setEditingId(null);
    flashOk("Modifié ✓");
  }, [editingLabel, editingCleaning, updateArticleTag, flashOk]);

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
        <input
          type="number"
          placeholder="Nettoyage (s)"
          value={newCleaning}
          onChange={(e) => setNewCleaning(e.target.value)}
          className="nettoyage"
          aria-label="Temps de nettoyage (secondes)"
          min={0}
          step={1}
          disabled={saving}
        />
        <button
          className="btn-enregistrer"
          type="button"            // ✅ empêche submit implicite
          onClick={handleAdd}
          disabled={saving}
        >
          Ajouter
        </button>
      </div>

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
          <TagItem
            key={tag.id}
            tag={tag}
            isEditing={editingId === tag.id}
            editingLabel={editingLabel}
            editingCleaning={editingCleaning}
            onChangeLabel={setEditingLabel}
            onChangeCleaning={setEditingCleaning}
            onEdit={onEditWrap(tag)}
            onDelete={onDeleteWrap(tag)}
            onSave={onSaveWrap(tag)}
            onCancel={onCancelWrap}
            showCleaning
            saving={saving}
            // 💡 si TagItem accepte des props pour typer ses boutons, passe-les :
            // actionButtonType="button"
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
      nettoyage: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ),
  addArticleTag: PropTypes.func.isRequired,
  updateArticleTag: PropTypes.func.isRequired,
  deleteArticleTag: PropTypes.func.isRequired,
};
