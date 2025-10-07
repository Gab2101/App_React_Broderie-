import React, { useEffect, useMemo, useState } from 'react'
import useSimulation from '../hooks/useSimulation'
import TagsPicker from './TagsPicker'

export default function CommandeFormModal(props = {}) {
  const { initialFormData, open, onClose, onSubmit } = props

  // 1) Initialise une seule fois à l'ouverture, ou quand l'ID change
  const [form, setForm] = useState(() => initialFormData ?? {})

  useEffect(() => {
    // ne reset que si la modale s'ouvre ou si on change de commande
    const id = initialFormData?.id ?? '__noid__'
    if (open) setForm(prev => (prev?.id === id ? prev : (initialFormData ?? {})))
    // deps stables : open + id seulement
  }, [open, initialFormData?.id])

  // 2) Mémo pour éviter que sim change à chaque render si form identique
  const simInput = useMemo(() => ({ formData: form }), [form])
  const sim = useSimulation(simInput)

  // 3) Handlers stables
  const handleChange = (patch) => setForm(f => ({ ...f, ...patch }))
  const handleSubmit = (e) => {
    e?.preventDefault?.()
    onSubmit?.(form)
  }

  if (!open) return null

  const isEditing = !!form.id
  const linkedId = form?.linked_commande_id || null

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
                    handleChange({ sameMachineAsLinked: false, startAfterLinked: false })
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
                    onChange={(e) => handleChange({ linked_commande_id: e.target.value || null })}
                  >
                    <option value="">-- choisir --</option>
                    {/* TODO: Add linkableCommandes as props */}
                  </select>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.sameMachineAsLinked)}
                    onChange={(e) => handleChange({ sameMachineAsLinked: e.target.checked })}
                  />
                  Même machine que la commande liée
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.startAfterLinked)}
                    onChange={(e) => handleChange({ startAfterLinked: e.target.checked })}
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
              value={form.numero || ''}
              onChange={(e) => handleChange({ numero: e.target.value })}
              required
            />
          </label>

          <label>
            Client :
            <input
              type="text"
              value={form.client || ''}
              onChange={(e) => handleChange({ client: e.target.value })}
              required
            />
          </label>

          <label>
            Quantité :
            <input
              type="number"
              value={form.quantite || ''}
              onChange={(e) => handleChange({ quantite: e.target.value })}
              min="1"
              required
            />
          </label>

          <label>
            Points :
            <input
              type="number"
              value={form.points || ''}
              onChange={(e) => handleChange({ points: e.target.value })}
              min="0"
              required
            />
          </label>

          <label>
            Vitesse moyenne (points/minute) :
            <input
              type="number"
              value={form.vitesseMoyenne || ''}
              onChange={(e) => handleChange({ vitesseMoyenne: e.target.value })}
              min="0.1"
              step="0.1"
            />
          </label>

          <label>
            Date livraison :
            <input
              type="date"
              value={form.dateLivraison || ''}
              onChange={(e) => handleChange({ dateLivraison: e.target.value })}
            />
          </label>

          <label>
            Urgence :
            <select name="urgence" value={form.urgence || 3} onChange={(e) => handleChange({ urgence: e.target.value })}>
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
              checked={Boolean(form.deballe)}
              onChange={(e) => handleChange({ deballe: e.target.checked })}
            />
            Commande déjà déballée
          </label>

          {/* ----- TAGS ----- */}
          <label>Types :</label>
          <TagsPicker
            items={[]} // TODO: Add articleTags as props
            selected={form.types || []}
            onToggle={(label) => {
              const types = form.types || []
              const newTypes = types.includes(label)
                ? types.filter(t => t !== label)
                : [...types, label];
              handleChange({ types: newTypes });
            }}
          />

          <label>Options :</label>
          <TagsPicker
            items={[]} // TODO: Add broderieTags as props
            selected={form.options || []}
            onToggle={(label) => {
              const options = form.options || []
              const newOptions = options.includes(label)
                ? options.filter(o => o !== label)
                : [...options, label];
              handleChange({ options: newOptions });
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
        </form>

        <button className="btn-fermer" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
