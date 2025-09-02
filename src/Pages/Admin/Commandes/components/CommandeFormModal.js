// src/Pages/Admin/Commandes/components/CommandeFormModal.js
import React, { useMemo, useState } from "react";
import { getAllowedBroderieForArticle, normalizeOne } from "../../../../utils/nettoyageRules";

/**
 * Calcule automatiquement le niveau d'urgence basé sur la date de livraison
 * @param {string} dateLivraison - Date de livraison au format YYYY-MM-DD
 * @returns {number} Niveau d'urgence (1-5)
 */
const calculateUrgency = (dateLivraison) => {
  if (!dateLivraison) return 1; // Faible par défaut
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normaliser à minuit pour comparaison précise
  
  const livraison = new Date(dateLivraison);
  livraison.setHours(0, 0, 0, 0);
  
  const diffTime = livraison.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 2) return 5;      // Urgence maximale
  if (diffDays < 5) return 4;      // Critique
  if (diffDays < 10) return 3;     // Élevée
  if (diffDays < 15) return 2;     // Moyenne
  return 1;                        // Faible
};

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

  // Calcul automatique de l'urgence basé sur la date de livraison
  const calculatedUrgency = useMemo(() => {
    return calculateUrgency(formData.dateLivraison);
  }, [formData.dateLivraison]);

  // Gestion du changement de date avec calcul automatique de l'urgence
  const handleDateChangeWithUrgency = (e) => {
    const value = e.target.value;
    const urgence = calculateUrgency(value);
    
    // Appeler le handleDateChange original s'il existe, sinon gérer directement
    if (handleDateChange) {
      handleDateChange(e);
    } else {
      handleChange({ target: { name: 'dateLivraison', value } });
    }
    
    // Mettre à jour l'urgence calculée
    handleChange({ target: { name: 'urgence', value: urgence } });
  };

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    // S'assurer que l'urgence est calculée avant soumission
    const urgenceFinale = calculateUrgency(formData.dateLivraison);
    if (formData.urgence !== urgenceFinale) {
      handleChange({ target: { name: 'urgence', value: urgenceFinale } });
    }

    // Route simplement selon la case "multi"
    if (multiEnabled) {
      onSubmit({ flow: "multi" });
      return;
    }

    onSubmit({ flow: "mono" });
  };

  // Fonction pour obtenir le libellé et la couleur de l'urgence
  const getUrgencyDisplay = (level) => {
    const urgencyMap = {
      1: { label: "Faible", color: "#4caf50" },
      2: { label: "Moyenne", color: "#2196f3" },
      3: { label: "Élevée", color: "#ff9800" },
      4: { label: "Critique", color: "#f44336" },
      5: { label: "Urgence maximale", color: "#000000" },
    };
    return urgencyMap[level] || urgencyMap[1];
  };

  const urgencyDisplay = getUrgencyDisplay(calculatedUrgency);

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
              onChange={handleDateChangeWithUrgency}
            />
          </label>

          {/* Affichage de l'urgence calculée automatiquement */}
          <div style={{ 
            padding: "12px", 
            borderRadius: "8px", 
            backgroundColor: "#f8f9fa",
            border: "1px solid #e9ecef",
            marginBottom: "15px"
          }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
              Urgence (calculée automatiquement) :
            </label>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px",
              padding: "8px 12px",
              borderRadius: "6px",
              backgroundColor: urgencyDisplay.color,
              color: urgencyDisplay.color === "#000000" ? "#ffffff" : "#ffffff",
              fontWeight: "600"
            }}>
              <span style={{ 
                width: "12px", 
                height: "12px", 
                borderRadius: "50%", 
                backgroundColor: "rgba(255,255,255,0.8)" 
              }}></span>
              Niveau {calculatedUrgency} - {urgencyDisplay.label}
            </div>
            {formData.dateLivraison && (
              <small style={{ color: "#6c757d", marginTop: "4px", display: "block" }}>
                Basé sur la date de livraison : {new Date(formData.dateLivraison).toLocaleDateString("fr-FR")}
              </small>
            )}
          </div>

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
