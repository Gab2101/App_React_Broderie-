import React, { useState, useEffect } from "react";
import useCommandesData from "../hooks/useCommandesData";
import useForm from "../hooks/useForm";
import useLinkedCommande from "../hooks/useLinkedCommande";
import useSimulation from "../hooks/useSimulation";
import useStatut from "../hooks/useStatut";
import { TagsPicker } from "./TagsPicker";

export default function CommandeFormModal({
  isOpen,
  onClose,
  onSave,
  commande,
  articleTags,
  broderieTags,
  linkableCommandes
}) {
  const isEditing = !!commande;
  const [saved, setSaved] = useState(false);

  const { formData, handleChange, resetForm, setFormData } = useForm({
    numero: "",
    client: "",
    quantite: "",
    points: "",
    vitesseMoyenne: "",
    dateLivraison: "",
    urgence: 3,
    deballe: false,
    types: [],
    options: [],
    linkedCommandeId: null,
    sameMachineAsLinked: false,
    startAfterLinked: false
  });

  const {
    numero,
    client,
    quantite,
    points,
    vitesseMoyenne,
    dateLivraison,
    urgence,
    deballe,
    types,
    options,
    linkedCommandeId,
    sameMachineAsLinked,
    startAfterLinked
  } = formData;

  // Liaison
  const { linkedCommandeId: linkedId, setLinkedCommandeId } = useLinkedCommande(linkedCommandeId);

  // Simulation
  const { simulation, simulate } = useSimulation();

  // Statut
  const { statut, setStatut } = useStatut();

  useEffect(() => {
    if (isOpen) {
      if (isEditing && commande) {
        setFormData({
          numero: commande.numero || "",
          client: commande.client || "",
          quantite: commande.quantite || "",
          points: commande.points || "",
          vitesseMoyenne: commande.vitesseMoyenne || "",
          dateLivraison: commande.dateLivraison || "",
          urgence: commande.urgence || 3,
          deballe: commande.deballe || false,
          types: commande.types || [],
          options: commande.options || [],
          linkedCommandeId: commande.linked_commande_id || null,
          sameMachineAsLinked: commande.same_machine_as_linked || false,
          startAfterLinked: commande.start_after_linked || false
        });
        setLinkedCommandeId(commande.linked_commande_id || null);
      } else {
        resetForm();
        setLinkedCommandeId(null);
      }
      setSaved(false);
    }
  }, [isOpen, isEditing, commande, setFormData, resetForm, setLinkedCommandeId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = {
      numero: numero.trim(),
      client: client.trim(),
      quantite: parseInt(quantite) || 0,
      points: parseInt(points) || 0,
      vitesseMoyenne: parseFloat(vitesseMoyenne) || 0,
      dateLivraison: dateLivraison || null,
      urgence: parseInt(urgence) || 3,
      deballe,
      types: types.filter(t => t.trim()),
      options: options.filter(o => o.trim()),
      linked_commande_id: linkedId,
      same_machine_as_linked: sameMachineAsLinked,
      start_after_linked: startAfterLinked
    };

    try {
      await onSave(data);
      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
    }
  };

  if (!isOpen) return null;

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
                checked={linkedId !== null}
                onChange={(e) => {
                  if (!e.target.checked) {
                    setLinkedCommandeId(null);
                    handleChange("sameMachineAsLinked", false);
                    handleChange("startAfterLinked", false);
                  }
                }}
              />
              Lier à une commande existante
            </label>

            {linkedId !== null && (
              <>
                <label>
                  Sélectionnez la commande liée :
                  <select
                    value={linkedId || ""}
                    onChange={(e) => setLinkedCommandeId(e.target.value || null)}
                  >
                    <option value="">-- choisir --</option>
                    {Array.isArray(linkableCommandes) &&
                      linkableCommandes.map((c) => (
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
                    onChange={(e) => handleChange("sameMachineAsLinked", e.target.checked)}
                  />
                  Même machine que la commande liée
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={startAfterLinked}
                    onChange={(e) => handleChange("startAfterLinked", e.target.checked)}
                  />
                  Commencer après la commande liée
                </label>
              </>
            )}
          </div>

          {/* ----- INFOS COMMANDE ----- */}
          <label>
            Numéro de commande :
            <input
              type="text"
              value={numero}
              onChange={(e) => handleChange("numero", e.target.value)}
              required
            />
          </label>

          <label>
            Client :
            <input
              type="text"
              value={client}
              onChange={(e) => handleChange("client", e.target.value)}
              required
            />
          </label>

          <label>
            Quantité :
            <input
              type="number"
              value={quantite}
              onChange={(e) => handleChange("quantite", e.target.value)}
              min="1"
              required
            />
          </label>

          <label>
            Points :
            <input
              type="number"
              value={points}
              onChange={(e) => handleChange("points", e.target.value)}
              min="0"
              required
            />
          </label>

          <label>
            Vitesse moyenne (points/minute) :
            <input
              type="number"
              value={vitesseMoyenne}
              onChange={(e) => handleChange("vitesseMoyenne", e.target.value)}
              min="0.1"
              step="0.1"
            />
          </label>

          <label>
            Date livraison :
            <input
              type="date"
              value={dateLivraison}
              onChange={(e) => handleChange("dateLivraison", e.target.value)}
            />
          </label>

          <label>
            Urgence :
            <select name="urgence" value={urgence} onChange={(e) => handleChange("urgence", e.target.value)}>
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
              checked={deballe}
              onChange={(e) => handleChange("deballe", e.target.checked)}
            />
            Commande déjà déballée
          </label>

          {/* ----- TAGS ----- */}
          <label>Types :</label>
          <TagsPicker
            items={articleTags}
            selected={types}
            onToggle={(label) => {
              const newTypes = types.includes(label)
                ? types.filter(t => t !== label)
                : [...types, label];
              handleChange("types", newTypes);
            }}
          />

          <label>Options :</label>
          <TagsPicker
            items={broderieTags}
            selected={options}
            onToggle={(label) => {
              const newOptions = options.includes(label)
                ? options.filter(o => o !== label)
                : [...options, label];
              handleChange("options", newOptions);
            }}
          />

          {/* ✅ Multi-machines */}
          <div className="bloc-liaison" style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={false} // TODO: implement multi-machine logic
                onChange={() => {}} // TODO: implement
              />
              Répartition multi-machines
            </label>
          </div>

          <button type="submit" className="btn-enregistrer">
            Enregistrer
          </button>

          {saved && <div className="message-saved">✅ Enregistré</div>}
        </form>

        <button className="btn-fermer" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
