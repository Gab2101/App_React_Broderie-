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
  // règles d’association (⚠️ ajoutées)
  nettoyageRules = [],
  // machines (cohérence)
  machines = [],
  // édition ?
  isEditing = false,
}) {
  // ---- Hooks (toujours en haut) ----
  const [multiEnabled, setMultiEnabled] = useState(false);

  // Article sélectionné = premier libellé de "types"
  const selectedArticleLabel = formData?.types?.[0] ?? null;

  // Set des options autorisées pour l’article sélectionné
  const allowedSet = useMemo(() => {
    try {
      if (!selectedArticleLabel) return null; // pas d’article => pas de filtre
      return getAllowedBroderieForArticle(nettoyageRules, selectedArticleLabel); // Set(normalized labels)
    } catch (e) {
      console.warn("[CommandeFormModal] getAllowedBroderieForArticle error:", e);
      return null;
    }
  }, [nettoyageRules, selectedArticleLabel]);

  // Liste des tags broderie affichés (filtrés si article choisi)
  const filteredBroderieTags = useMemo(() => {
    const list = Array.isArray(broderieTags) ? broderieTags : [];
    if (!selectedArticleLabel) return list;        // avant choix d’article, on montre tout
    if (!allowedSet) return list;                  // si pas de règles, ne filtre pas
    return list.filter((tag) => allowedSet.has(normalizeOne(tag.label)));
  }, [broderieTags, selectedArticleLabel, allowedSet]);

  // ---- Garde l’early return APRÈS les hooks (ESLint OK) ----
  if (!isOpen) return null;

  // Sélection d’un article : comportement exclusif (un seul type)
  const handleSelectArticle = (label) => {
    // si déjà sélectionné, ne rien faire (ou forcer quand même)
    if (formData?.types?.[0] === label && (formData?.types?.length || 0) === 1) return;

    handleChange({ target: { name: "types", value: [label] } });
    // Les options seront auto-remplies par le useEffect ci-dessus
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ flow: multiEnabled ? "multi" : "mono" });
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

          {/* ----- TAGS : ARTICLES ----- */}
          <label>Types :</label>
          <div className="tags-container">
            {Array.isArray(articleTags) &&
              articleTags.map((tag) => {
                const active = formData.types?.[0] === tag.label && (formData.types?.length || 0) === 1;
                return (
                  <button
                    key={tag.label}
                    type="button"
                    className={`tag ${active ? "active" : ""}`}
                    onClick={() => handleSelectArticle(tag.label)}
                  >
                    {tag.label}
                  </button>
                );
              })}
          </div>

          {/* ----- TAGS : BRODERIE (filtrés) ----- */}
          <label>Options :</label>
          <div className="tags-container" aria-disabled={!selectedArticleLabel}>
            {Array.isArray(filteredBroderieTags) &&
              filteredBroderieTags.map((tag) => (
                <button
                  key={tag.id ?? tag.label}
                  type="button"
                  className={`tag ${formData.options.includes(tag.label) ? "active" : ""}`}
                  disabled={!selectedArticleLabel}
                  onClick={() => toggleTag("options", tag.label)}
                >
                  {tag.label}
                </button>
              ))}
          </div>
          {!selectedArticleLabel && (
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
              Sélectionnez d’abord un article pour voir/auto-sélectionner les options.
            </div>
          )}

          <button type="submit" className="btn-enregistrer">Enregistrer</button>
        </form>

        {saved && <div className="message-saved">✅ Enregistré</div>}
        <button className="btn-fermer" onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}
