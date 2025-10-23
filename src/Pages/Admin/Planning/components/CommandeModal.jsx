// src/Pages/Admin/Planning/components/CommandeModal.jsx
import React from "react";
import supabase from '@/lib/supabaseClient'

const PARIS_TZ = "Europe/Paris";

export default function CommandeModal({
  commande,
  onClose,
  onOptimisticReplace,
  onTermineeShortenPlanning,
  updateCommandeStatut,
  allowedStatuts = ["A commencer", "En cours", "Terminée"],
}) {
  const [statut, setStatut] = React.useState(commande?.statut ?? "A commencer");
  const [dateLivraison, setDateLivraison] = React.useState(
    commande?.dateLivraison ? commande.dateLivraison.split('T')[0] : ""
  );
  const [deballe, setDeballe] = React.useState(Boolean(commande?.deballe));
  const [validationClient, setValidationClient] = React.useState(Boolean(commande?.validation_client));
  const [marchandiseRecue, setMarchandiseRecue] = React.useState(Boolean(commande?.marchandise_recue));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setStatut(commande?.statut ?? "A commencer");
    setDateLivraison(
      commande?.dateLivraison ? commande.dateLivraison.split('T')[0] : ""
    );
    setDeballe(Boolean(commande?.deballe));
    setValidationClient(Boolean(commande?.validation_client));
    setMarchandiseRecue(Boolean(commande?.marchandise_recue));
  }, [commande?.id, commande?.statut, commande?.dateLivraison, commande?.deballe, commande?.validation_client, commande?.marchandise_recue]);

  const handleSave = async () => {
    if (!commande?.id) return;

    // Check if any changes
    const hasChanges = (
      (commande.statut ?? "A commencer") !== statut ||
      (commande.dateLivraison?.split('T')[0] ?? "") !== dateLivraison ||
      Boolean(commande?.deballe) !== deballe ||
      Boolean(commande?.validation_client) !== validationClient ||
      Boolean(commande?.marchandise_recue) !== marchandiseRecue
    );

    if (!hasChanges) {
      onClose?.();
      return;
    }

    setSaving(true);
    setError("");

    const optimistic = {
      ...commande,
      statut,
      dateLivraison: dateLivraison ? `${dateLivraison}T00:00:00` : commande.dateLivraison,
      deballe,
      validation_client: validationClient,
      marchandise_recue: marchandiseRecue
    };
    onOptimisticReplace?.(optimistic);

    try {
      // Update statut
      if ((commande.statut ?? "A commencer") !== statut) {
        await updateCommandeStatut(commande.id, statut);
      }

      // Update dateLivraison
      if ((commande.dateLivraison?.split('T')[0] ?? "") !== dateLivraison) {
        const { error: dateError } = await supabase
          .from("commandes")
          .update({ dateLivraison: dateLivraison ? `${dateLivraison}T00:00:00` : null })
          .eq("id", commande.id);
        if (dateError) throw dateError;
      }

      // Update deballe
      if (Boolean(commande?.deballe) !== deballe) {
        const { error: deballeError } = await supabase
          .from("commandes")
          .update({ deballe })
          .eq("id", commande.id);
        if (deballeError) throw deballeError;
      }

      // Update marchandise_recue
      if (Boolean(commande?.marchandise_recue) !== marchandiseRecue) {
        const { error: marchandiseError } = await supabase
          .from("commandes")
          .update({ marchandise_recue: marchandiseRecue })
          .eq("id", commande.id);
        if (marchandiseError) throw marchandiseError;
      }

      // Si "Terminée" → coupe à l'heure pleine suivante côté planning (Paris)
      if (statut === "Terminée") {
        await onTermineeShortenPlanning?.(commande.id, new Date());
      }
      onClose?.();
    } catch (e) {
      onOptimisticReplace?.(commande);
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  if (!commande) return null;

  return (
    <div style={{
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
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
        padding: '24px',
        maxWidth: '400px',
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
        }}>
          Commande #{commande.numero}
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <div style={{
            padding: '12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            marginBottom: '16px',
          }}>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#374151',
              marginBottom: '8px',
            }}>
              <strong>Client :</strong> {commande.client}
            </p>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#374151',
            }}>
              <strong>Date de livraison :</strong>{" "}
              {commande.dateLivraison
                ? new Date(commande.dateLivraison).toLocaleDateString("fr-FR", {
                    timeZone: PARIS_TZ,
                  })
                : "—"}
            </p>
          </div>

          <label style={{
            display: 'block',
            marginBottom: '16px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Statut
            <select
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
              disabled={saving}
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
              {allowedStatuts.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label style={{
            display: 'block',
            marginBottom: '20px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Date de livraison
            <input
              type="date"
              value={dateLivraison}
              onChange={(e) => setDateLivraison(e.target.value)}
              disabled={saving}
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
              checked={deballe}
              onChange={(e) => setDeballe(e.target.checked)}
              disabled={saving}
              style={{
                width: '16px',
                height: '16px',
              }}
            />
            Commande déjà déballée
          </label>

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
              checked={validationClient}
              onChange={(e) => setValidationClient(e.target.checked)}
              disabled={saving}
              style={{
                width: '16px',
                height: '16px',
              }}
            />
            Validation client
          </label>

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
              checked={marchandiseRecue}
              onChange={(e) => setMarchandiseRecue(e.target.checked)}
              disabled={saving}
              style={{
                width: '16px',
                height: '16px',
              }}
            />
            Marchandise reçue ?
          </label>

          {error && (
            <div style={{
              marginBottom: '16px',
              padding: '8px 12px',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            paddingTop: '16px',
            borderTop: '1px solid #e5e7eb',
          }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
              onMouseOut={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Fermer
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                opacity: saving ? 0.7 : 1,
              }}
              onMouseOver={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = '#0056b3';
              }}
              onMouseOut={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = '#007bff';
              }}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
