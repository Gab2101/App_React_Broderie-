import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import TagItem from "./TagItem";
import "./TagItems.css";

/**
 * BroderieTagsSection
 * — Gestion des tags de broderie (label seul)
 * — Ajout, édition inline, suppression, recherche, feedback
 * — S'aligne sur l'API de Parametres: fonctions qui retournent { ok, reason? }
 */
export default function BroderieTagsSection({
  broderieTags = [],
  addBroderieTag,
  updateBroderieTag,
  deleteBroderieTag,
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
    if (!q) return broderieTags;
    return broderieTags.filter((t) => t.label?.toLowerCase().includes(q));
  }, [broderieTags, search]);

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) {
      setError("Le nom ne peut pas être vide");
      setSuccess("");
      return;
    }
    setSaving(true);
    const res = await addBroderieTag(label);
    setSaving(false);
    if (!res?.ok) {
      setError(res?.reason || "Erreur d'ajout");
      return;
    }
    setNewLabel("");
    flashOk("Ajout réussi !");
  };

  const flashOk = (msg) => {
    setError("");
    setSuccess(msg);
    setTimeout(() => setSuccess("") , 1500);
  };

  return (
    <div className="tags-list" aria-live="polite">
      <h3>Options de broderie</h3>

      {/* Ajout */}
      <div className="ajout-section">
        <input
          type="text"
          placeholder="Nom de l'option"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          aria-label="Nom de l'option de broderie"
          disabled={saving}
        />
        <button className="btn-enregistrer" onClick={handleAdd} disabled={saving}>
          Ajouter
        </button>
      </div>

      {/* Feedback */}
      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}

      {/* Recherche */}
      <input
        type="text"
        placeholder="🔍 Rechercher une option de broderie..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 10, padding: 6, width: "100%" }}
        aria-label="Rechercher une option de broderie"
      />

      {/* Liste */}
      <ul>
        {filtered.map((tag) => (
          <TagItem
            key={tag.id}
            tag={tag}
            isEditing={editingId === tag.id}
            editingLabel={editingLabel}
            onChangeLabel={setEditingLabel}
            onEdit={() => {
              setEditingId(tag.id);
              setEditingLabel(tag.label);
              setError("");
            }}
            onDelete={() => deleteBroderieTag(tag.id)}
            onSave={async () => {
              const label = editingLabel.trim();
              if (!label) return setError("Le nom ne peut pas être vide");
              setSaving(true);
              const res = await updateBroderieTag(tag.id, label);
              setSaving(false);
              if (!res?.ok) return setError(res?.reason || "Erreur de mise à jour");
              setEditingId(null);
              flashOk("Modifié ✓");
            }}
            onCancel={() => setEditingId(null)}
            showCleaning={false}
            saving={saving}
          />
        ))}
      </ul>
    </div>
  );
}

BroderieTagsSection.propTypes = {
  broderieTags: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), label: PropTypes.string })
  ),
  addBroderieTag: PropTypes.func.isRequired,
  updateBroderieTag: PropTypes.func.isRequired,
  deleteBroderieTag: PropTypes.func.isRequired,
};
