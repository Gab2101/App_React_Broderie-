// src/Pages/Admin/Commandes/components/CommandeFormModal.js
import React, { useMemo, useState } from "react";
import { getAllowedBroderieForArticle, normalizeOne } from "../../../../utils/nettoyageRules";

const slugify = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, "-");

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
  // machines
  machines = [],
  // édition ?
  isEditing = false,
}) {
  // ⚠️ Tous les hooks AVANT tout return conditionnel
  const [multiEnabled, setMultiEnabled] = useState(false);

  // Champs sécurisés
  const numero = formData?.numero ?? "";
  const client = formData?.client ?? "";
  const quantite = formData?.quantite ?? "";
  const points = formData?.points ?? "";
  const vitesseMoyenne = formData?.vitesseMoyenne ?? "";
  const dateLivraison = formData?.dateLivraison ?? "";
  const urgence = formData?.urgence ?? 3;
  const deballe = !!formData?.deballe; // ✅ NEW: booléen déballé

  const selectedTypes = useMemo(
  () => (Array.isArray(formData?.types) ? formData.types : []),
  [formData?.types]
);

const selectedOptions = useMemo(
  () => (Array.isArray(formData?.options) ? formData.options : []),
  [formData?.options]
);

  // ✅ NEW: Sets pour des includes O(1)
  const selectedTypesSet = useMemo(() => new Set(selectedTypes), [selectedTypes]);
  const selectedOptionsSet = useMemo(() => new Set(selectedOptions), [selectedOptions]);

  const selectedArticleLabel = selectedTypes?.[0] ?? null;

  // Ensemble des options autorisées pour l’article sélectionné
  const allowedSet = useMemo(() => {
    try {
      if (!selectedArticleLabel) return null;
      const set = getAllowedBroderieForArticle(broderieTags || [], selectedArticleLabel);
      return set && set.size > 0 ? set : null;
    } catch {
      return null;
    }
  }, [selectedArticleLabel, broderieTags]);

  // Liste affichée : si allowedSet est null → on montre tout
  const filteredBroderieTags = useMemo(() => {
    const list = Array.isArray(broderieTags) ? broderieTags : [];
    if (!allowedSet) return list;
    return list.filter((tag) => allowedSet.has(normalizeOne(tag.label)));
  }, [broderieTags, allowedSet]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(multiEnabled ? { flow: "multi" } : { flow: "mono" });
  };

  // ✅ NEW: handler pour cocher/décocher "déballé"
  const handleDeballeChange = (e) => {
    const checked = e.target.checked;
    // on fabrique un "event" compatible pour ton handleChange
    handleChange?.({ target: { name: "deballe", value: checked } });
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
                checked={!!isLinked}
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
                        .filter((c) => !formData?.id || c.id !== formData.id)
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
                    checked={!!sameMachineAsLinked}
                    onChange={(e) => setSameMachineAsLinked(e.target.checked)}
                    disabled={!linkedCommandeId}
                  />
                  Utiliser la même brodeuse (même machine) que la commande liée
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!startAfterLinked}
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
              value={numero}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Client :
            <input
              type="text"
              name="client"
              value={client}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Quantité :
            <input
              type="number"
              name="quantite"
              value={quantite}
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
              value={points}
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
              value={vitesseMoyenne}
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
              value={dateLivraison}
              onChange={handleDateChange}
              aria-label="Date de livraison (JJ/MM/AAAA)"
            />
          </label>

          <label>
            Urgence :
            <select name="urgence" value={urgence} onChange={handleChange}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          {/* ✅ NEW: Déballé ? */}
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              name="deballe"
              checked={deballe}
              onChange={handleDeballeChange}
            />
            Commande déballée ?
          </label>

          {/* ----- TAGS ----- */}
          <label>Types :</label>
          <div className="tags-container">
            {Array.isArray(articleTags) &&
              articleTags.map((tag, idx) => {
                const isActive = selectedTypesSet.has(tag.label); // ✅ Set
                const key = tag.id ?? `article-${slugify(tag.label)}-${idx}`;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`tag ${isActive ? "active" : ""}`}
                    onClick={() => toggleTag("types", tag.label)}
                    aria-pressed={isActive}
                    title={tag.label}
                  >
                    {tag.label}
                  </button>
                );
              })}
          </div>

          <label>Options :</label>
          <div className="tags-container">
            {Array.isArray(filteredBroderieTags) &&
              filteredBroderieTags.map((tag, idx) => {
                const isActive = selectedOptionsSet.has(tag.label); // ✅ Set
                const key = tag.id ?? `option-${slugify(tag.label)}-${idx}`;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`tag ${isActive ? "active" : ""}`}
                    onClick={() => toggleTag("options", tag.label)}
                    aria-pressed={isActive}
                    title={tag.label}
                  >
                    {tag.label}
                  </button>
                );
              })}
          </div>

          {/* ✅ Multi-machines */}
          <div className="bloc-liaison" style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={multiEnabled}
                onChange={(e) => setMultiEnabled(e.target.checked)}
              />
              Faire avec plusieurs machines : Indisponible pour le moment
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
