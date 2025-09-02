// src/Pages/Admin/Commandes/hooks/useCommandesData.js
import { useEffect, useState } from "react";
import { supabase } from "../../../../supabaseClient";
import { replaceCommandeInArray } from "../../../../utils/CommandesService";
import { fetchNettoyageRules } from "../../../../utils/nettoyageRules";

export default function useCommandesData() {
  const [commandes, setCommandes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [linkableCommandes, setLinkableCommandes] = useState([]);
  const [nettoyageRules, setNettoyageRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState(null);

  const reloadData = async () => {
    try {
      const [
        { data: commandesData, error: err1 },
        { data: machinesData, error: err2 },
        { data: planningData, error: err3 },
      ] = await Promise.all([
        supabase.from("commandes").select("*"),
        supabase.from("machines").select("*"),
        supabase.from("planning").select("*"),
      ]);

      if (err1 || err2 || err3) {
        console.error("Erreur chargement données:", err1, err2, err3);
        return;
      }

      setCommandes(commandesData || []);
      setMachines(machinesData || []);
      setPlanning(planningData || []);

      const { data: cmdLinkables, error: errLink } = await supabase
        .from("commandes")
        .select("id, numero, client, statut, machineAssignee")
        .in("statut", ["A commencer", "En cours"]);
      if (!errLink) setLinkableCommandes(cmdLinkables || []);

      // Chargement des règles de nettoyage avec gestion d'erreur
      setRulesLoading(true);
      setRulesError(null);
      try {
        const rules = await fetchNettoyageRules();
        setNettoyageRules(rules || []);
      } catch (error) {
        console.error("Erreur chargement règles de nettoyage:", error);
        setRulesError(error.message || "Erreur de chargement des règles");
        setNettoyageRules([]);
      } finally {
        setRulesLoading(false);
      }
    } catch (err) {
      console.error("Erreur reloadData:", err);
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Realtime sur nettoyage_rules pour mise à jour automatique
  useEffect(() => {
    const channel = supabase
      .channel("realtime-nettoyage-rules")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nettoyage_rules" },
        () => {
          // Recharger les règles quand elles changent
          fetchNettoyageRules()
            .then(rules => setNettoyageRules(rules || []))
            .catch(error => {
              console.error("Erreur rechargement règles:", error);
              setRulesError(error.message || "Erreur de rechargement");
            });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel("realtime-commandes-page")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (payload) => {
          setCommandes((prev) => replaceCommandeInArray(prev, payload.new));
          setLinkableCommandes((prev) => {
            const isEligible = ["A commencer", "En cours"].includes(payload.new.statut);
            const exists = prev.some((c) => String(c.id) === String(payload.new.id));
            if (isEligible && !exists) return [...prev, payload.new];
            if (!isEligible && exists) return prev.filter((c) => String(c.id) !== String(payload.new.id));
            return prev.map((c) => (String(c.id) === String(payload.new.id) ? payload.new : c));
          });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  return {
    commandes,
    setCommandes,
    machines,
    planning,
    linkableCommandes,
    nettoyageRules,
    rulesLoading,
    rulesError,
    reloadData,
  };
}
