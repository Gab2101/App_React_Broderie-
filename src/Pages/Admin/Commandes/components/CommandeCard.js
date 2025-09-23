// src/Pages/Admin/Commandes/components/CommandeCard.jsx
import React from "react";
import StatusBadge from "../../../../components/common/StatusBadge";
import { convertDecimalToTime } from "../../../../utils/time";
import { calculerDurees } from "../../../../utils/calculs";
import { computeNettoyageSecondsForOrder } from "../../../../utils/nettoyageRules";
import { clampPercentToStep5 } from "../utils/timeRealtime";
import { getColorFromId, getUrgencyColor, computeUrgency } from "../../Planning/lib/priority";
import { useError } from "../../../../hooks/useError";

const parisDateTime = (d, opts = {}) =>
  d ? new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris", ...opts }) : null;
const parisDate = (d) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : null;

export default function CommandeCard({
  cmd,
  STATUTS,
  onChangeStatut,
  onEdit,
  onDelete,
  machines = [],
  articleTags = [],
  nettoyageRules = [],
  onToggleDeballe, // (id, bool) => Promise|void
}) {
  const { handleError } = useError();

  const bg = getColorFromId(cmd.id);
  const urgencyLevel = Number(cmd?.urgence ?? computeUrgency(cmd?.dateLivraison));
  const borderColor = getUrgencyColor(urgencyLevel);

  // ✅ État local optimiste pour "déballé"
  const [deballeLocal, setDeballeLocal] = React.useState(!!cmd?.deballe);
  const [savingDeballe, setSavingDeballe] = React.useState(false);
  React.useEffect(() => {
    // se resynchronise si le parent change (refetch, etc.)
    setDeballeLocal(!!cmd?.deballe);
  }, [cmd?.deballe, cmd?.id]);

  const isTerminee = (cmd.statut || "") === "Terminée";

  // ★ Helpers pour l'auto-déballage & masquage UI
  const shouldAutoDeballe = (statut) => statut === "En cours" || statut === "Terminée";
  const isRunningOrDone = shouldAutoDeballe(cmd?.statut);
  const hideADeballerUI = deballeLocal || isRunningOrDone; // si déjà déballé ou en cours/terminée → on cache

  // ★ Backfill/sanitation si la donnée arrive déjà en "En cours/Terminée" avec deballe=false
  const autoSetRef = React.useRef(false);
  React.useEffect(() => {
    if (!autoSetRef.current && shouldAutoDeballe(cmd?.statut) && !cmd?.deballe) {
      autoSetRef.current = true; // éviter les doubles appels
      (async () => {
        try {
          setSavingDeballe(true);
          setDeballeLocal(true); // optimiste
          await onToggleDeballe?.(cmd.id, true);
        } catch (e) {
          handleError(e, { context: 'Auto-déballage de la commande' });
          setDeballeLocal(false); // rollback si échec
        } finally {
          setSavingDeballe(false);
        }
      })();
    }
  }, [cmd?.statut, cmd?.deballe, cmd?.id, onToggleDeballe]);

  const handleStatusChange = async (e) => {
    const next = e.target.value;
    if (next === "Terminée" && !isTerminee) {
      const ok = window.confirm(
        "Confirmer le passage au statut « Terminée » ?\nCe statut sera verrouillé."
      );
      if (!ok) return;
    }

    // ★ si on passe à En cours/Terminée et que deballe n'est pas encore true → forcer à true (persisté)
    if (shouldAutoDeballe(next) && !deballeLocal) {
      try {
        setSavingDeballe(true);
        setDeballeLocal(true);              // optimiste
        await onToggleDeballe?.(cmd.id, true);
      } catch (err) {
        handleError(err, { context: 'Mise à jour automatique du statut déballé' });
        setDeballeLocal(false);             // rollback si échec
      } finally {
        setSavingDeballe(false);
      }
    }

    onChangeStatut(cmd.id, next);
  };

  // ✅ Toggle optimiste + sync parent/DB
  const handleToggleDeballe = async (e) => {
    const checked = e.target.checked;
    setDeballeLocal(checked);                  // maj immédiate UI
    try {
      setSavingDeballe(true);
      await onToggleDeballe?.(cmd.id, checked); // le parent persiste (Supabase)
    } catch (err) {
      handleError(err, { context: 'Mise à jour du statut déballé' });
      setDeballeLocal((v) => !v);               // rollback si échec
    } finally {
      setSavingDeballe(false);
    }
  };

  // Durées (fallback calcul si manquantes)
  let b = cmd.duree_broderie_heures;
  let n = cmd.duree_nettoyage_heures;
  let t = cmd.duree_totale_heures;

  if (b == null || n == null || t == null) {
    const etiquetteArticle = cmd?.types?.[0] || null;
    const nettoyageSec = computeNettoyageSecondsForOrder(
      etiquetteArticle,
      cmd?.options,
      nettoyageRules,
      articleTags
    );
    const quantite = Number(cmd?.quantite || 0);
    const points = Number(cmd?.points || 0);
    const nbTetes = Number(machines.find((m) => m.nom === cmd?.machineAssignee)?.nbTetes || 1);
    const vitessePPM = Number(cmd?.vitesseMoyenne || 680);

    const calc = calculerDurees({
      quantite,
      points,
      vitesse: vitessePPM,
      nbTetes,
      nettoyageParArticleSec: nettoyageSec,
    });

    b = calc.dureeBroderieHeures;
    n = calc.dureeNettoyageHeures;
    t = calc.dureeTotaleHeures;
  }

  const theoriqueTotal = (Number(b) || 0) + (Number(n) || 0);
  const coefAffiche =
    theoriqueTotal > 0
      ? clampPercentToStep5(Math.round((Number(t || 0) / theoriqueTotal) * 100))
      : null;

  const debutLabel = parisDateTime(cmd?.started_at, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  const finLabel   = parisDateTime(cmd?.finished_at, { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
  const livraisonLabel = parisDate(cmd?.dateLivraison);

  return (
    <div
      className="carte-commande"
      style={{
        backgroundColor: bg,
        borderLeft: `6px solid ${borderColor}`,
        border: "1px solid #e0e0e0",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        position: "relative",
      }}
    >
      {/* ✅ Badge "À déballer" — n'apparaît plus si statut En cours/Terminée ou si déjà déballé */}
      {!hideADeballerUI && !deballeLocal && (
        <div
          title="Commande à déballer"
          aria-label="Commande à déballer"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid #f5c2c7",
            background: "#f8d7da",
            color: "#842029",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          ⚠️ À déballer
        </div>
      )}

      <div
        className="carte-commande__header"
        style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}
      >
        <h3 style={{ margin: 0 }}>Commande #{cmd.numero}</h3>
        <StatusBadge statut={cmd.statut || "A commencer"} />
      </div>

      {/* ✅ Toggle déballé — masqué si déjà déballé ou si En cours/Terminée */}
      {!hideADeballerUI && (
        <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={deballeLocal}
            onChange={handleToggleDeballe}
            aria-label="Commande déballée"
            disabled={savingDeballe}
          />
          <span>Commande déballée {savingDeballe ? "…" : ""}</span>
        </p>
      )}

      <p><strong>Client :</strong> {cmd.client}</p>
      {Array.isArray(cmd.types) && cmd.types.length > 0 && (
        <p><strong>Types textile :</strong> {cmd.types.join(", ")}</p>
      )}
      <p><strong>Quantité :</strong> {cmd.quantite}</p>
      <p><strong>Points :</strong> {cmd.points}</p>
      <p><strong>Urgence :</strong> {cmd.urgence}</p>
      <p><strong>Livraison :</strong> {livraisonLabel || "—"}</p>

      <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>Statut :</strong>{" "}
        <StatusBadge statut={cmd.statut || "A commencer"} size="sm" />
        <select
          value={cmd.statut || "A commencer"}
          onChange={handleStatusChange}
          disabled={isTerminee}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${borderColor}`,
            backgroundColor: isTerminee ? "#f5f5f5" : "#fff",
            color: "#333",
            outlineColor: borderColor,
            cursor: isTerminee ? "not-allowed" : "pointer",
          }}
          title={isTerminee ? "Statut verrouillé (Terminée)" : "Changer le statut"}
          aria-label="Changer le statut de la commande"
        >
          {STATUTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </p>

      {debutLabel && <p><strong>Début de commande :</strong> {debutLabel}</p>}
      {finLabel &&   <p><strong>Fin de commande :</strong> {finLabel}</p>}
      {cmd.machineAssignee && <p><strong>Machine :</strong> {cmd.machineAssignee}</p>}

      {(cmd.linked_commande_id || cmd.same_machine_as_linked || cmd.start_after_linked) && (
        <div className="bloc-liaison-info">
          <strong>Liaison :</strong>{" "}
          {cmd.linked_commande_id ? `#${cmd.linked_commande_id}` : "—"} •{" "}
          {cmd.same_machine_as_linked ? "même brodeuse" : "brodeuse libre"} •{" "}
          {cmd.start_after_linked ? "enchaînée après" : "non enchaînée"}
        </div>
      )}

      <p>
        <strong>Durée totale :</strong> {convertDecimalToTime(t ?? 0)}
        {coefAffiche ? <em style={{ marginLeft: 6, opacity: 0.7 }}>({coefAffiche}% appliqué)</em> : null}
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => onEdit(cmd)}
          className="btn-enregistrer"
          style={{ borderRadius: 8 }}
          disabled={isTerminee}
          title={isTerminee ? "Commande terminée : édition désactivée" : "Modifier"}
        >
          Modifier
        </button>
        <button
          onClick={() => onDelete(cmd.id)}
          className="btn-fermer"
          style={{ borderRadius: 8 }}
          title="Supprimer la commande"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
