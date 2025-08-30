// src/Pages/Admin/Commandes/components/CommandeFormModal.js
import React, { useMemo, useState } from "react";
import { getAllowedBroderieForArticle, normalizeOne } from "../../../../utils/nettoyageRules";

export default function CommandeFormModal({
  isOpen,
  onClose,
  onSubmit,
  // form
  formData,
  handleChange,
  handleDateChange,
  toggleTag,
  saved,
  // liaison
  isLinked,
  setIsLinked,
  linkedCommandeId,
  setLinkedCommandeId,
  sameMachineAsLinked,
  setSameMachineAsLinked,
  startAfterLinked,
  setStartAfterLinked,
  linkableCommandes,
  // tags
  articleTags = [],
  broderieTags = [],
  // machines (kept for consistency if parent passes it)
  machines = [],
  // édition ?
  isEditing = false,
}) {
  const [multiEnabled, setMultiEnabled] = useState(false);

  const selectedArticleLabel = formData?.types?.[0] ?? null;

  const allowedSet = useMemo(() => {
    try {
      if (!selectedArticleLabel) return null;
      return getAllowedBroderieForArticle([], selectedArticleLabel);
    } catch {
      return null;
    }
  }, [selectedArticleLabel]);

  const filteredBroderieTags = useMemo(() => {
    const list = Array.isArray(broderieTags) ? broderieTags : [];
    if (!allowedSet || allowedSet.size === 0) return list;
    return list.filter((tag) => allowedSet.has(normalizeOne(tag.label)));
  }, [broderieTags, allowedSet]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    // Route simplement selon la case "multi"
    if (multiEnabled) {
      onSubmit({ flow: "multi" });
      return;
    }

    onSubmit({ flow: "mono" });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{isEditing ? "Modifier la commande" : "Nouvelle commande"}</h2>

        <form className="formulaire-commande" onSubmit={handleSubmit}>
          {/* ----- LIAISON ----- */}
          <div className="bloc-liaison">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={isLinked}
                onChange={(e) => {
                  const val = e.target.checked;
                  setIsLinked(val);
                  if (!val) {
                    setLinkedCommandeId(null);
                    setSameMachineAsLinked(false);
                    setStartAfterLinked(true);
                  }
                }}
              />
              Cette commande est-elle liée à une commande existante ?
            </label>

            {isLinked && (
              <>
                <label>
                  Sélectionnez la commande liée :
                  <select
                    value={linkedCommandeId || ""}
                    onChange={(e) =>
                      setLinkedCommandeId(e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    <option value="">-- choisir --</option>
                    {Array.isArray(linkableCommandes) &&
                      linkableCommandes
                        .filter((c) => !formData.id || c.id !== formData.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            #{c.numero} — {c.client} ({c.statut})
                          </option>
                        ))}
                  </select>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={sameMachineAsLinked}
                    onChange={(e) => setSameMachineAsLinked(e.target.checked)}
                    disabled={!linkedCommandeId}
                  />
                  Utiliser la même brodeuse (même machine) que la commande liée
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={startAfterLinked}
                    onChange={(e) => setStartAfterLinked(e.target.checked)}
                    disabled={!linkedCommandeId}
                  />
                  Planifier après la commande liée (enchaînement)
                </label>
              </>
            )}
          </div>

          {/* ----- INFOS COMMANDE ----- */}
          <label>
            Numéro de commande :
            <input
              type="text"
              name="numero"
              value={formData.numero}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Client :
            <input
              type="text"
              name="client"
              value={formData.client}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Quantité :
            <input
              type="number"
              name="quantite"
              value={formData.quantite}
              onChange={handleChange}
              min="1"
              required
            />
          </label>

          <label>
            Points :
            <input
              type="number"
              name="points"
              value={formData.points}
              onChange={handleChange}
              min="1"
              required
            />
          </label>

          <label>
            Vitesse moyenne (points/minute) :
            <input
              type="number"
              name="vitesseMoyenne"
              value={formData.vitesseMoyenne}
              onChange={handleChange}
              placeholder="680"
              min="1"
            />
          </label>

          <label>
            Date livraison :
            <input
              type="date"
              name="dateLivraison"
              value={formData.dateLivraison}
              onChange={handleDateChange}
            />
          </label>

          <label>
            Urgence :
            <select name="urgence" value={formData.urgence} onChange={handleChange}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          {/* ----- TAGS ----- */}
          <label>Types :</label>
          <div className="tags-container">
            {Array.isArray(articleTags) &&
              articleTags.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  className={`tag ${formData.types.includes(tag.label) ? "active" : ""}`}
                  onClick={() => toggleTag("types", tag.label)}
                >
                  {tag.label}
                </button>
              ))}
          </div>

          <label>Options :</label>
          <div className="tags-container">
            {Array.isArray(filteredBroderieTags) &&
              filteredBroderieTags.map((tag) => (
                <button
                  key={tag.id ?? tag.label}
                  type="button"
                  className={`tag ${formData.options.includes(tag.label) ? "active" : ""}`}
                  onClick={() => toggleTag("options", tag.label)}
                >
                  {tag.label}
                </button>
              ))}
          </div>

          {/* ✅ Multi-machines (pas de bouton "Configurer…") */}
          <div className="bloc-liaison" style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={multiEnabled}
                onChange={(e) => setMultiEnabled(e.target.checked)}
              />
              Faire avec plusieurs machines
            </label>
          </div>

          <button type="submit" className="btn-enregistrer">
            Enregistrer
          </button>
        </form>

        {saved && <div className="message-saved">✅ Enregistré</div>}
        <button className="btn-fermer" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
