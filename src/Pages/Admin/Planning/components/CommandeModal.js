import React from "react";

export default function CommandeModal({
  commande,
  onClose,
  onOptimisticReplace,
  onTermineeShortenPlanning,
  updateCommandeStatut,
  // ⬇️ Optionnel: passe la liste autorisée depuis le parent si besoin
  allowedStatuts = ["A commencer", "En cours", "Terminée"], 
}) {
  const [statut, setStatut] = React.useState(commande?.statut ?? "A commencer");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setStatut(commande?.statut ?? "A commencer");
  }, [commande?.id, commande?.statut]);

  const handleSave = async () => {
    if (!commande?.id) return;

    // ⬇️ rien à faire si aucun changement
    if ((commande.statut ?? "A commencer") === statut) {
      onClose?.();
      return;
    }

    setSaving(true);
    setError("");

    const optimistic = { ...commande, statut };
    onOptimisticReplace?.(optimistic);

    try {
      const saved = await updateCommandeStatut(commande.id, statut);
      onOptimisticReplace?.(saved);

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
    <div
      className="modal-overlay"
      onClick={!saving ? onClose : undefined}        
      role="dialog"
      aria-modal="true"
      aria-labelledby={`cmd-title-${commande.id}`}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 id={`cmd-title-${commande.id}`}>Commande #{commande.numero}</h3>
        <p><strong>Client :</strong> {commande.client}</p>
        <p>
          <strong>Date de livraison :</strong>{" "}
          {commande.dateLivraison
            ? new Date(commande.dateLivraison).toLocaleDateString("fr-FR")
            : "—"}
        </p>

        <label className="field" style={{ display: "block", marginTop: 12 }}>
          <span style={{ display: "block", marginBottom: 6 }}>
            <strong>Statut</strong>
          </span>
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
            disabled={saving}
          >
            {allowedStatuts.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {error && (
          <div className="error" role="alert" style={{ marginTop: 8 }}>
            {error}
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={saving}>Fermer</button>
          <button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
