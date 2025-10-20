// src/Pages/Admin/Commandes/hooks/useCommandesData.js
import { useEffect, useState, useCallback } from 'react'
import supabase from '@/lib/supabaseClient'
import { replaceCommandeInArray } from '@/utils/CommandesService'
import { fetchNettoyageRules } from '@/utils/nettoyageRules'
import { dayBoundsParisUTC } from '../utils/workhours'
import { attachCommandesListener } from '@/realtime/commandesChannel'

export default function useCommandesData() {
  const [commandes, setCommandes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [linkableCommandes, setLinkableCommandes] = useState([]);
  const [nettoyageRules, setNettoyageRules] = useState([]);
  const [articleTags, setArticleTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Recharge tout, ou uniquement le planning qui chevauche un "day" (Europe/Paris)
  const reloadData = async (day = null) => {
    setLoading(true);
    setError(null);

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
        { data: articleTagsData, error: err4 },
      ] = await Promise.all([
        supabase.from("commandes").select("*"),
        supabase.from("machines").select("*"),
        planningQuery,
        supabase.from("articleTags").select("*"),
      ]);

      if (err1 || err2 || err3 || err4) {
        console.error("Erreur chargement données:", err1, err2, err3, err4);
        setError(err1 || err2 || err3 || err4);
        // Set empty arrays to prevent app crash
        setCommandes([]);
        setMachines([]);
        setPlanning([]);
        setLinkableCommandes([]);
        setNettoyageRules([]);
        setArticleTags([]);
        setLoading(false);
        return;
      }

      if (err1 || err2 || err3) {
        console.error("Erreur chargement données:", err1, err2, err3);
        setError(err1 || err2 || err3);
        // Set empty arrays to prevent app crash
        setCommandes([]);
        setMachines([]);
        setPlanning([]);
        setLinkableCommandes([]);
        setNettoyageRules([]);
        setLoading(false);
        return;
      }

      setCommandes(commandesData || []);
      setMachines(machinesData || []);
      setPlanning(planningData || []);
      setArticleTags(articleTagsData || []);

      // Commandes "liables" = statuts actifs
      const { data: cmdLinkables, error: errLink } = await supabase
        .from("commandes")
        .select("id, numero, client, statut, machineAssignee")
        .in("statut", ["A commencer", "En cours"]);

      if (errLink) {
        console.error("Erreur chargement commandes liables:", errLink);
        setError(errLink);
        setLinkableCommandes([]);
      } else {
        setLinkableCommandes(cmdLinkables || []);
      }

      const rules = await fetchNettoyageRules();
      setNettoyageRules(rules || []);
      setLoading(false);
    } catch (err) {
      console.error("Erreur reloadData:", err);
      setError(err);
      // Set empty arrays to prevent app crash
      setCommandes([]);
      setMachines([]);
      setPlanning([]);
      setLinkableCommandes([]);
      setNettoyageRules([]);
      setLoading(false);
    }
  };

  // Chargement initial
  useEffect(() => {
    reloadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime : utilise le canal partagé pour éviter les duplications
  useEffect(() => {
    const detach = attachCommandesListener(payload => {
      // Applique les mises à jour selon le type d'événement
      if (payload.eventType === 'INSERT') {
        setCommandes((prev) => [payload.new, ...prev]);
        // Ajouter aux linkables si éligible
        setLinkableCommandes((prev) => {
          const isEligible = ["A commencer", "En cours"].includes(payload.new.statut);
          return isEligible ? [payload.new, ...prev] : prev;
        });
      }

      if (payload.eventType === 'UPDATE') {
        setCommandes((prev) => replaceCommandeInArray(prev, payload.new));
        // Mettre à jour linkables
        setLinkableCommandes((prev) => {
          const isEligible = ["A commencer", "En cours"].includes(payload.new.statut);
          const exists = prev.some((c) => String(c.id) === String(payload.new.id));
          if (isEligible && !exists) return [payload.new, ...prev];
          if (!isEligible && exists) return prev.filter((c) => String(c.id) !== String(payload.new.id));
          return prev.map((c) => (String(c.id) === String(payload.new.id) ? payload.new : c));
        });
      }

      if (payload.eventType === 'DELETE') {
        setCommandes((prev) => prev.filter((c) => String(c.id) !== String(payload.old.id)));
        setLinkableCommandes((prev) => prev.filter((c) => String(c.id) !== String(payload.old.id)));
      }
    });

    return detach;
  }, []);

  const refreshCommandes = useCallback(() => {
    return reloadData();
  }, []);

  const deleteCommandeWithPlanning = useCallback(async (id) => {
    try {
      const { error } = await supabase
        .from("planning")
        .delete()
        .eq("commandeId", id);

      if (error) {
        return { error };
      }

      const { error: deleteError } = await supabase
        .from("commandes")
        .delete()
        .eq("id", id);

      if (deleteError) {
        return { error: deleteError };
      }

      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }, []);

  return {
    commandes,
    setCommandes,
    machines,
    planning,
    linkableCommandes,
    nettoyageRules,
    articleTags,
    loading,
    error,
    reloadData,
    refreshCommandes,
    deleteCommandeWithPlanning,
  };
}
