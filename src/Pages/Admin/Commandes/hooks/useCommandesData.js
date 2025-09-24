// src/Pages/Admin/Commandes/hooks/useCommandesData.js
import { useEffect, useState } from "react";
import { supabase } from "../../../../supabaseClient";
import { replaceCommandeInArray } from "../../../../utils/CommandesService";
import { fetchNettoyageRules } from "../../../../utils/nettoyageRules";
import { dayBoundsParisUTC } from "../utils/workhours";

export default function useCommandesData() {
  const [commandes, setCommandes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [linkableCommandes, setLinkableCommandes] = useState([]);
  const [nettoyageRules, setNettoyageRules] = useState([]);

  // Recharge tout, ou uniquement le planning qui chevauche un "day" (Europe/Paris)
  const reloadData = async (day = null) => {
    try {
      let planningQuery = supabase.from("planning").select("*");
      if (day) {
        const { startUTC, endUTC } = dayBoundsParisUTC(day);
        planningQuery = planningQuery
          // chevauchement journée Paris : fin >= débutJour && debut < finJour
          .gte("fin", startUTC.toISOString())
          .lt("debut", endUTC.toISOString());
      }

      const [
        { data: commandesData, error: err1 },
        { data: machinesData, error: err2 },
        { data: planningData, error: err3 },
      ] = await Promise.all([
        supabase.from("commandes").select("*"),
        supabase.from("machines").select("*"),
        planningQuery,
      ]);

      if (err1 || err2 || err3) {
        console.error("Erreur chargement données:", err1, err2, err3);
        // Set empty arrays to prevent app crash
        setCommandes([]);
        setMachines([]);
        setPlanning([]);
        setLinkableCommandes([]);
        setNettoyageRules([]);
        return;
      }

      setCommandes(commandesData || []);
      setMachines(machinesData || []);
      setPlanning(planningData || []);

      // Commandes "liables" = statuts actifs
      const { data: cmdLinkables, error: errLink } = await supabase
        .from("commandes")
        .select("id, numero, client, statut, machineAssignee")
        .in("statut", ["A commencer", "En cours"]);

      if (errLink) {
        console.error("Erreur chargement commandes liables:", errLink);
        setLinkableCommandes([]);
      } else {
        setLinkableCommandes(cmdLinkables || []);
      }

      const rules = await fetchNettoyageRules();
      setNettoyageRules(rules || []);
    } catch (err) {
      console.error("Erreur reloadData:", err);
      // Set empty arrays to prevent app crash
      setCommandes([]);
      setMachines([]);
      setPlanning([]);
      setLinkableCommandes([]);
      setNettoyageRules([]);
    }
  };

  // Chargement initial
  useEffect(() => {
    reloadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime : commandes + planning (INSERT/UPDATE/DELETE)
  useEffect(() => {
    const ch = supabase.channel("realtime-commandes-page");

    // --- COMMANDES ---
    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "commandes" },
      ({ new: row }) => {
        setCommandes((prev) => [...prev, row]);
        setLinkableCommandes((prev) => {
          const isEligible = ["A commencer", "En cours"].includes(row.statut);
          return isEligible ? [...prev, row] : prev;
        });
      }
    );

    ch.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "commandes" },
      ({ new: row }) => {
        setCommandes((prev) => replaceCommandeInArray(prev, row));
        setLinkableCommandes((prev) => {
          const isEligible = ["A commencer", "En cours"].includes(row.statut);
          const exists = prev.some((c) => String(c.id) === String(row.id));
          if (isEligible && !exists) return [...prev, row];
          if (!isEligible && exists) return prev.filter((c) => String(c.id) !== String(row.id));
          return prev.map((c) => (String(c.id) === String(row.id) ? row : c));
        });
      }
    );

    ch.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "commandes" },
      ({ old: row }) => {
        setCommandes((prev) => prev.filter((c) => String(c.id) !== String(row.id)));
        setLinkableCommandes((prev) => prev.filter((c) => String(c.id) !== String(row.id)));
      }
    );

    // --- PLANNING ---
    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "planning" },
      ({ new: row }) => setPlanning((prev) => [...prev, row])
    );

    ch.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "planning" },
      ({ new: row }) =>
        setPlanning((prev) => prev.map((p) => (String(p.id) === String(row.id) ? row : p)))
    );

    ch.on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "planning" },
      ({ old: row }) => setPlanning((prev) => prev.filter((p) => String(p.id) !== String(row.id)))
    );

    ch.subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  return {
    commandes,
    setCommandes,
    machines,
    planning,
    linkableCommandes,
    nettoyageRules,
    reloadData, // reloadData(day?: Date) -> borne la journée Paris côté requête planning
  };
}
