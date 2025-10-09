import { useEffect, useMemo, useState } from 'react'
import useSimulation from '../hooks/useSimulation'

export default function CommandeFormModal(props = {}) {
  const { isOpen, onClose, onSave, commande, linkedCommandeId, setLinkedCommandeId, linkableCommandes } = props

  // 1) Initialise une seule fois à l'ouverture, ou quand l'ID change
  const [form, setForm] = useState(() => commande ?? {})

  useEffect(() => {
    // ne reset que si la modale s'ouvre ou si on change de commande
    const id = commande?.id ?? '__noid__'
    if (isOpen) setForm(prev => (prev?.id === id ? prev : (commande ?? {})))
    // deps stables : isOpen + id seulement
  }, [isOpen, commande?.id])

  // 2) Mémo pour éviter que sim change à chaque render si form identique
  const simInput = useMemo(() => ({ formData: form }), [form])
  const sim = useSimulation(simInput)

  // 3) Handlers stables
  const handleChange = (patch) => setForm(f => ({ ...f, ...patch }))
  const handleSubmit = (e) => {
    e?.preventDefault?.()
    onSave?.(form)
  }

  if (!isOpen) return null

  const isEditing = !!form.id
  const linkedId = form?.linked_commande_id || null

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div className="modal" style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
        padding: '24px',
        maxWidth: '480px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        margin: '20px',
      }}>
        <h2 style={{
          marginTop: 0,
          marginBottom: '20px',
          fontSize: '24px',
          fontWeight: '600',
          color: '#2c3e50',
        }}>{isEditing ? "Modifier la commande" : "Nouvelle commande"}</h2>

        <form className="formulaire-commande" onSubmit={handleSubmit} style={{ marginTop: 0 }}>
          {/* REMOVE: Command linking functionality not implemented/working */}

          {/* ----- INFOS COMMANDE ----- */}
          <label style={{
            display: 'block',
            marginBottom: '16px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Numéro de commande :
            <input
              type="text"
              value={form.numero || ''}
              onChange={(e) => handleChange({ numero: e.target.value })}
              required
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                marginTop: '4px',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{
            display: 'block',
            marginBottom: '16px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Client :
            <input
              type="text"
              value={form.client || ''}
              onChange={(e) => handleChange({ client: e.target.value })}
              required
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                marginTop: '4px',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{
            display: 'block',
            marginBottom: '16px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Quantité :
            <input
              type="number"
              value={form.quantite || ''}
              onChange={(e) => handleChange({ quantite: e.target.value })}
              min="1"
              required
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                marginTop: '4px',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{
            display: 'block',
            marginBottom: '16px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Points :
            <input
              type="number"
              value={form.points || ''}
              onChange={(e) => handleChange({ points: e.target.value })}
              min="0"
              required
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                marginTop: '4px',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{
            display: 'block',
            marginBottom: '16px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Vitesse moyenne (points/minute) :
            <input
              type="number"
              value={form.vitesseMoyenne || ''}
              onChange={(e) => handleChange({ vitesseMoyenne: e.target.value })}
              min="0.1"
              step="0.1"
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                marginTop: '4px',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{
            display: 'block',
            marginBottom: '16px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Date livraison :
            <input
              type="date"
              value={form.dateLivraison || ''}
              onChange={(e) => handleChange({ dateLivraison: e.target.value })}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                marginTop: '4px',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{
            display: 'block',
            marginBottom: '16px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Urgence :
            <select
              name="urgence"
              value={form.urgence || 3}
              onChange={(e) => handleChange({ urgence: e.target.value })}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                marginTop: '4px',
                boxSizing: 'border-box',
                backgroundColor: 'white',
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          {/* ✅ Déballé ? */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: '16px',
            fontWeight: '500',
            color: '#374151',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={Boolean(form.deballe)}
              onChange={(e) => handleChange({ deballe: e.target.checked })}
              style={{
                width: '16px',
                height: '16px',
              }}
            />
            Commande déjà déballée
          </label>

          {/* ✅ Validation client */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: '20px',
            fontWeight: '500',
            color: '#374151',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={Boolean(form.validation_client)}
              onChange={(e) => handleChange({ validation_client: e.target.checked })}
              style={{
                width: '16px',
                height: '16px',
              }}
            />
            Validation client
          </label>



          {/* submit button */}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '16px',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
          >
            Enregistrer
          </button>
        </form>

        <button
          style={{
            width: '100%',
            padding: '10px 24px',
            backgroundColor: 'transparent',
            color: '#6b7280',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          onClick={onClose}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
