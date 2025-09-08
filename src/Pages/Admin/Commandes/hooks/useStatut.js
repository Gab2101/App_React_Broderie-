// src/Pages/Admin/Commandes/hooks/useStatut.js
import { updateCommandeStatutWithAutoTimes, replaceCommandeInArray } from "../../../../utils/CommandesService";
import { roundUpToNextHourParis } from "../utils/workhours";

export default function useStatut({ commandes, setCommandes }) {
  const STATUTS = ["A commencer", "En cours", "Terminée"];

  const handleChangeStatut = async (id, newStatut) => {
    const prevList = commandes;
    const current = commandes.find((c) => String(c.id) === String(id));
    if (!current) return;

    // ✅ Confirmation: uniquement si on passe de "A commencer" -> "En cours"
    if (current.statut === "A commencer" && newStatut === "En cours") {
      const ok = window.confirm(
        "Êtes-vous sûr de démarrer cette commande ?\n" +
        "Passer de 'A commencer' à 'En cours' n’est pas modifiable."
      );
      if (!ok) return; // on annule si l’utilisateur refuse
    }

    const optimistic = { ...current, statut: newStatut };

    // Règle: arrondi à l'heure supérieure Paris, stocké en UTC ISO
    const nowRoundedISO = roundUpToNextHourParis(new Date()).toISOString();
    if (newStatut === "En cours" && !current.started_at) {
      optimistic.started_at = nowRoundedISO;
    }
    if (newStatut === "Terminée" && !current.finished_at) {
      optimistic.finished_at = nowRoundedISO;
    }

    setCommandes((prev) => replaceCommandeInArray(prev, optimistic));

    try {
      const saved = await updateCommandeStatutWithAutoTimes(current, newStatut);
      setCommandes((prev) => replaceCommandeInArray(prev, saved));
    } catch (e) {
      console.error("Erreur mise à jour statut:", e);
      setCommandes(prevList); // rollback
      alert("La mise à jour du statut a échoué.");
    }
  };

  return { STATUTS, handleChangeStatut };
}
