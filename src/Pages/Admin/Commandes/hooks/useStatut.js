// src/Pages/Admin/Commandes/hooks/useStatut.js
import { updateCommandeStatutWithAutoTimes, replaceCommandeInArray } from "../../../../utils/CommandesService";

export default function useStatut({ commandes, setCommandes }) {
  const STATUTS = ["A commencer", "En cours", "En pause", "Terminée", "Annulée"];

  const handleChangeStatut = async (id, newStatut) => {
    const prevList = commandes;
    const current = commandes.find((c) => String(c.id) === String(id));
    if (!current) return;

    const optimistic = { ...current, statut: newStatut };
    const nowISO = new Date().toISOString();
    if (newStatut === "En cours" && !current.started_at) optimistic.started_at = nowISO;
    if (newStatut === "Terminée" && !current.finished_at) optimistic.finished_at = nowISO;

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
