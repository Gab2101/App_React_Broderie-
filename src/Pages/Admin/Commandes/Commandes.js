// src/Pages/Admin/Commandes/Commandes.js
import React, { useState, useEffect, useContext, useMemo } from "react";
import "../../../styles/Commandes.css";
import { EtiquettesContext } from "../../../context/EtiquettesContext";
import NewButton from "../../../components/common/NewButton";
import { supabase } from "../../../supabaseClient";
import {
  getNextFullHour,
  convertDecimalToTime,
  convertHoursToHHMM,
  nextWorkStart,
  addWorkingHours,
} from "../../../utils/time";
import { calculerDurees } from "../../../utils/calculs";
import { updateCommandeStatutWithAutoTimes, replaceCommandeInArray } from "../../../utils/CommandesService";

/* ==== Statut (couleurs + badge) ==== */
import StatusBadge from "../../../components/common/StatusBadge";
import { getStatusTheme } from "../../../utils/statusTheme";

/* ==== Règles de nettoyage (article × zone) ==== */
import {
  fetchNettoyageRules,
  getAllowedBroderieForArticle,
  computeNettoyageSecondsForOrder,
  normalizeOne,
} from "../../../utils/nettoyageRules";

/* ======================================
   Helpers commande liée
====================================== */
const getLinkedLastFinishAndMachineId = (planningArr, commandeId) => {
  const rows = (planningArr || []).filter((p) => p.commandeId === commandeId);
  if (!rows.length) return { lastFinish: null, machineId: null };
  rows.sort((a, b) => new Date(a.fin) - new Date(b.fin));
  const last = rows[rows.length - 1];
  return { lastFinish: new Date(last.fin), machineId: last.machineId ?? null };
};

const getMachineByName = (machinesArr, name) =>
  machinesArr.find(
    (m) => (m.nom || "").trim().toLowerCase() === String(name || "").trim().toLowerCase()
  ) || null;

/* ======================================
   Helpers de normalisation pour étiquettes
====================================== */
const toLabelArray = (raw) => {
  if (!raw) return [];
  try {
    if (Array.isArray(raw)) return raw.map(normalizeOne).filter(Boolean);
    if (typeof raw === "string") {
      const s = raw.trim();
      if (s.startsWith("[") && s.endsWith("]")) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(normalizeOne).filter(Boolean);
      }
      return s.split(",").map(normalizeOne).filter(Boolean);
    }
    return [normalizeOne(raw)].filter(Boolean);
  } catch {
    return [];
  }
};

/* ======================================
   Helpers de calcul pour le "temps réel"
====================================== */
const roundMinutesTo5 = (m) => Math.max(0, Math.round(m / 5) * 5);
const clampPercentToStep5 = (p) => {
  const clamped = Math.min(500, Math.max(50, p));
  return clamped - (clamped % 5);
};

// Fin provisoire selon un début et des minutes appliquées
const computeProvisionalEnd = (debut, minutesAppliquees) => {
  if (!debut || !minutesAppliquees) return null;
  return addWorkingHours(debut, minutesAppliquees / 60);
};

/* =========================
   Composant principal
========================= */
function Commandes() {
  const [showModal, setShowModal] = useState(false);
  const [commandes, setCommandes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [saved, setSaved] = useState(false);
  const [nettoyageRules, setNettoyageRules] = useState([]);

  const [selectedScenario, setSelectedScenario] = useState(null);
  const [machineAssignee, setMachineAssignee] = useState(null);

  // ---- Contrôle du pourcentage "Temps réel" dans la modale de confirmation
  const [confirmCoef, setConfirmCoef] = useState(350); // % par défaut

  const { articleTags, broderieTags } = useContext(EtiquettesContext);

  const emptyForm = {
    id: null,
    numero: "",
    client: "",
    quantite: "",
    points: "",
    urgence: 3,
    dateLivraison: "",
    types: [],    // article (ex: "T-shirt") -> on prend le 1er
    options: [],  // zones (ex: "coeur", "dos", etc.)
    vitesseMoyenne: "", // PPM par tête
  };

  const [formData, setFormData] = useState(emptyForm);

  // --- LIAISON COMMANDE ---
  const [isLinked, setIsLinked] = useState(false);
  const [linkedCommandeId, setLinkedCommandeId] = useState(null);
  const [sameMachineAsLinked, setSameMachineAsLinked] = useState(false);
  const [startAfterLinked, setStartAfterLinked] = useState(true);
  const [linkableCommandes, setLinkableCommandes] = useState([]);

  /* =========================
     Chargement des données + Realtime
  ========================= */
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

      // commandes éligibles au chaînage
      const { data: cmdLinkables, error: errLink } = await supabase
        .from("commandes")
        .select("id, numero, client, statut, machineAssignee")
        .in("statut", ["A commencer", "En cours"]);
      if (!errLink) setLinkableCommandes(cmdLinkables || []);

      // règles de nettoyage
      const rules = await fetchNettoyageRules();
      setNettoyageRules(rules || []);
    } catch (err) {
      console.error("Erreur reloadData:", err);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  // 🔴 Realtime: refléter en direct les UPDATE faits ailleurs (ex. planning/commandes)
  useEffect(() => {
    const ch = supabase
      .channel("realtime-commandes-page")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "commandes" },
        (payload) => {
          setCommandes((prev) => replaceCommandeInArray(prev, payload.new));
          // Met à jour la liste des commandes chaînables si le statut a changé
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

  /* =========================
     Formulaire
  ========================= */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e) => {
    const value = e.target.value;
    const today = new Date();
    const selectedDate = new Date(value);

    const diffDays = Math.ceil((selectedDate - today) / (1000 * 60 * 60 * 24));

    let urgence = 1;
    if (diffDays < 2) urgence = 5;
    else if (diffDays < 5) urgence = 4;
    else if (diffDays < 10) urgence = 3;
    else if (diffDays < 15) urgence = 2;

    setFormData((prev) => ({
      ...prev,
      dateLivraison: value,
      urgence,
    }));
  };

  const toggleTag = (type, tag) => {
    setFormData((prev) => {
      const current = [...prev[type]];
      const index = current.indexOf(tag);
      if (index > -1) current.splice(index, 1);
      else current.push(tag);
      return { ...prev, [type]: current };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (parseInt(formData.quantite, 10) <= 0 || parseInt(formData.points, 10) <= 0) {
      alert("La quantité et le nombre de points doivent être supérieurs à zéro.");
      return;
    }

    if (formData.id) {
      await handleUpdateCommande();
      return;
    }

    await handleSimulation();
  };

  const handleUpdateCommande = async () => {
    const { error: updateError } = await supabase.from("commandes").update(formData).eq("id", formData.id);

    if (updateError) {
      alert("Erreur lors de la mise à jour.");
      console.error(updateError);
      return;
    }

    reloadData();
    resetForm();
  };

  /* =========================
     Simulation d'affectation
  ========================= */
  const handleSimulation = async () => {
    // 1) Normalise les besoins
    const neededTypes = toLabelArray(formData.types);
    const neededOptions = toLabelArray(formData.options);

    // 2) Prépare la liste des machines avec étiquettes normalisées
    const machinesWithLabels = machines.map((m) => ({
      ...m,
      _labels: toLabelArray(m.etiquettes),
    }));

    // --- Contraintes si commande liée ---
    let debutMinOverride = null; // si on ancre après la liée
    let forcedMachine = null; // si "même brodeuse" imposée

    if (isLinked && linkedCommandeId) {
      const linkedIdNum = Number(linkedCommandeId);

      // 1) récupérer fin & machine de la liée (depuis state planning)
      const { lastFinish, machineId: linkedMachineId } = getLinkedLastFinishAndMachineId(
        planning,
        linkedIdNum
      );

      // 2) ancrage de début
      if (startAfterLinked) {
        debutMinOverride = lastFinish ? nextWorkStart(lastFinish) : getNextFullHour();
      }

      // 3) même brodeuse
      if (sameMachineAsLinked) {
        if (linkedMachineId) {
          forcedMachine = machines.find((m) => m.id === linkedMachineId) || null;
        } else {
          const linkedCmd = commandes.find((c) => c.id === linkedIdNum);
          if (linkedCmd?.machineAssignee) {
            forcedMachine = getMachineByName(machines, linkedCmd.machineAssignee);
          }
        }

        if (!forcedMachine) {
          alert("La commande liée n'a pas encore de brodeuse fixée. Planifie-la d'abord ou décoche 'même brodeuse'.");
          return;
        }
      }
    }

    // 3) Filtre strict (types + options)
    const compatiblesStrict = machinesWithLabels.filter((m) => {
      if (forcedMachine && m.id !== forcedMachine.id) return false;
      const hasTypes = neededTypes.every((t) => m._labels.includes(t));
      const hasOptions = neededOptions.every((o) => m._labels.includes(o));
      return hasTypes && hasOptions;
    });

    // 4) Fallback : types seulement
    const compatibles =
      compatiblesStrict.length > 0
        ? compatiblesStrict
        : machinesWithLabels.filter((m) => {
            if (forcedMachine && m.id !== forcedMachine.id) return false;
            return neededTypes.every((t) => m._labels.includes(t));
          });

    if (compatibles.length === 0) {
      alert("Aucune machine compatible. Vérifie 'types' / 'options' (casse/espaces).");
      console.debug("[DEBUG] types demandés:", neededTypes);
      console.debug("[DEBUG] options demandées:", neededOptions);
      console.debug(
        "[DEBUG] machines & étiquettes:",
        machinesWithLabels.map((m) => ({ id: m.id, nom: m.nom, labels: m._labels }))
      );
      return;
    }

    // 5) Scénarios par machine compatible
    const scenariosLocaux = [];
    for (const m of compatibles) {
      const now = Date.now();
      const planifies = (planning || [])
        .filter((p) => p.machineId === m.id && new Date(p.fin).getTime() >= now)
        .sort((a, b) => new Date(a.debut) - new Date(b.debut));

      const nowDispo = getNextFullHour();
      const lastFin = planifies.length ? new Date(planifies[planifies.length - 1].fin) : null;
      const anchorBase = lastFin && lastFin > nowDispo ? lastFin : nowDispo;
      const anchor = debutMinOverride && debutMinOverride > anchorBase ? debutMinOverride : anchorBase;

      const debut = nextWorkStart(anchor);

      // 🔹 Nettoyage piloté par les règles (somme des zones)
      const etiquetteArticle = formData.types?.[0] || null;
      const nettoyageParArticleSec = computeNettoyageSecondsForOrder(
        etiquetteArticle,
        formData.options,
        nettoyageRules,
        articleTags
      );

      const { dureeBroderieHeures, dureeNettoyageHeures, dureeTotaleHeures } = calculerDurees({
        quantite: Number(formData.quantite || 0),
        points: Number(formData.points || 0),
        vitesse: Number(formData.vitesseMoyenne || 680),
        nbTetes: Number(m.nbTetes || 1),
        nettoyageParArticleSec,
      });

      const dureeTotaleHeuresArrondie = Math.ceil(dureeTotaleHeures);
      const fin = addWorkingHours(debut, dureeTotaleHeuresArrondie);

      scenariosLocaux.push({
        machine: m,
        debut,
        fin,
        dureeBroderieHeures,
        dureeNettoyageHeures,
        // "Reelle" = théorique calculée (nom conservé pour compat)
        dureeTotaleHeuresReelle: dureeTotaleHeures,
        dureeTotaleHeuresArrondie,
      });
    }

    scenariosLocaux.sort((a, b) => a.fin - b.fin);
    const meilleur = scenariosLocaux[0];

    setScenarios(scenariosLocaux);
    setSelectedScenario(meilleur);
    setMachineAssignee(meilleur.machine.id);
    setConfirmCoef(350); // reset du coef au moment du choix
    setShowModal(false);
  };

  const scenarioByMachineId = useMemo(() => {
    const map = new Map();
    for (const sc of scenarios) map.set(sc.machine.id, sc);
    return map;
  }, [scenarios]);

  // Le scénario courant suit la machine choisie
  const currentScenario = useMemo(() => {
    const sc = machineAssignee != null
      ? scenarioByMachineId.get(Number(machineAssignee))
      : selectedScenario;
    return sc || selectedScenario;
  }, [scenarioByMachineId, machineAssignee, selectedScenario]);

  // Minutes théoriques (du scénario courant) sur lesquelles on applique le %
  const minutesTheoriques = useMemo(() => {
    if (!currentScenario) return 0;
    const h = Number(currentScenario.dureeTotaleHeuresReelle || 0);
    return Math.max(0, Math.round(h * 60));
  }, [currentScenario]);

  const minutesReellesAppliquees = useMemo(() => {
    const raw = Math.round((minutesTheoriques * confirmCoef) / 100);
    return roundMinutesTo5(raw);
  }, [minutesTheoriques, confirmCoef]);

  /* =========================
     Confirmation de création (avec % temps réel)
  ========================= */
  const confirmCreation = async () => {
    const machine = machines.find((m) => String(m.id) === String(machineAssignee));
    if (!machine) {
      alert("Machine invalide.");
      return;
    }

    {
      const machineLabels = toLabelArray(machine.etiquettes);
      const neededTypes = toLabelArray(formData.types);
      const ok = neededTypes.every((t) => machineLabels.includes(t));
      if (!ok) {
        alert("Machine incompatible (types).");
        return;
      }
    }

    let debutMinOverride = null;
    if (isLinked && linkedCommandeId && startAfterLinked) {
      const { lastFinish } = getLinkedLastFinishAndMachineId(planning, Number(linkedCommandeId));
      if (lastFinish) debutMinOverride = nextWorkStart(lastFinish);
    }

    if (isLinked && sameMachineAsLinked && linkedCommandeId) {
      const { machineId: linkedMachineId } = getLinkedLastFinishAndMachineId(
        planning,
        Number(linkedCommandeId)
      );
      const linkedCmd = commandes.find((c) => c.id === Number(linkedCommandeId));
      const linkedMachineByName = linkedCmd?.machineAssignee
        ? getMachineByName(machines, linkedCmd.machineAssignee)
        : null;
      const expectedId = linkedMachineId ?? linkedMachineByName?.id ?? null;

      if (expectedId && String(machine.id) !== String(expectedId)) {
        alert("La machine sélectionnée doit être la même que celle de la commande liée.");
        return;
      }
    }

    // Recalcule théorique (sécurisation) pour stocker les champs broderie/nettoyage
    const etiquetteArticle = formData.types?.[0] || null;
    const vitesseBase = parseInt(formData.vitesseMoyenne, 10) || 680;

    const nettoyageParArticleSec = computeNettoyageSecondsForOrder(
      etiquetteArticle,
      formData.options,
      nettoyageRules,
      articleTags
    );

    const {
      dureeBroderieHeures,
      dureeNettoyageHeures,
      dureeTotaleHeures: dureeTotaleHeuresTheorique,
    } = calculerDurees({
      quantite: Number(formData.quantite || 0),
      points: Number(formData.points || 0),
      vitesse: Number(vitesseBase),
      nbTetes: Number(machine.nbTetes || 1),
      nettoyageParArticleSec, // 👈 règles appliquées
    });

    // ---- Application du pourcentage "Temps réel"
    const minutesTheoriquesLocal = Math.round(dureeTotaleHeuresTheorique * 60);
    const minutesReellesLocal = roundMinutesTo5(
      Math.round((minutesTheoriquesLocal * confirmCoef) / 100)
    );

    // Début / fin selon temps réel
    const now = Date.now();
    const planifies = (planning || [])
      .filter((p) => p.machineId === machine.id && new Date(p.fin).getTime() >= now)
      .sort((a, b) => new Date(a.debut) - new Date(b.debut));

    const nowDispo = getNextFullHour();
    const lastFin = planifies.length ? new Date(planifies[planifies.length - 1].fin) : null;
    const anchorBase = lastFin && lastFin > nowDispo ? lastFin : nowDispo;
    const anchor = debutMinOverride && debutMinOverride > anchorBase ? debutMinOverride : anchorBase;
    const debut = nextWorkStart(anchor);
    const fin = addWorkingHours(debut, minutesReellesLocal / 60); // addWorkingHours prend des heures

    const { id, ...formSansId } = formData;

    // On stocke :
    // - broderie/nettoyage (théoriques) pour transparence
    // - duree_totale_heures = temps réel choisi (minutes appliquées / 60)
    // - duree_totale_heures_arrondie = Math.ceil(temps réel en heures) pour compat
    const dureeTotaleHeuresReelleAppliquee = minutesReellesLocal / 60;
    const dureeTotaleHeuresArrondie = Math.ceil(dureeTotaleHeuresReelleAppliquee);

    const payload = {
      ...formSansId,
      machineAssignee: machine.nom,
      vitesseMoyenne: vitesseBase,
      // Historique / transparence :
      duree_broderie_heures: dureeBroderieHeures,
      duree_nettoyage_heures: dureeNettoyageHeures,
      // Valeur appliquée au planning (réelle) :
      duree_totale_heures: dureeTotaleHeuresReelleAppliquee,
      duree_totale_heures_arrondie: dureeTotaleHeuresArrondie,
      // Statut & liaisons :
      statut: "A commencer",
      linked_commande_id: isLinked ? Number(linkedCommandeId) : null,
      same_machine_as_linked: Boolean(isLinked && sameMachineAsLinked),
      start_after_linked: Boolean(isLinked && startAfterLinked),
    };

    const { data: createdCmd, error: errorCmd } = await supabase
      .from("commandes")
      .insert([payload])
      .select()
      .single();

    if (errorCmd) {
      console.error("Erreur création commande:", errorCmd);
      alert("Erreur lors de la création de la commande.\n" + (errorCmd.message || "Regarde la console."));
      return;
    }

    const { error: errorPlanning } = await supabase.from("planning").insert([
      {
        machineId: machine.id,
        commandeId: createdCmd.id,
        debut: debut.toISOString(),
        debutTheorique: debut.toISOString(),
        fin: fin.toISOString(),
      },
    ]);

    if (errorPlanning) {
      console.error("Erreur création planning:", errorPlanning);
      alert("La commande a été créée, mais l'insertion dans le planning a échoué.\n" + (errorPlanning.message || ""));
    }

    setSelectedScenario(null);
    setMachineAssignee(null);
    setShowModal(false);
    setScenarios([]);
    reloadData();
    resetForm();
  };

  /* =========================
     Statut commande (optimistic + auto started_at/finished_at)
  ========================= */
  const STATUTS = ["A commencer", "En cours", "En pause", "Terminée", "Annulée"];

  const handleChangeStatut = async (id, newStatut) => {
    const prevList = commandes;
    const current = commandes.find((c) => String(c.id) === String(id));
    if (!current) return;

    // Optimistic UI (+ timestamps si besoin)
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

  /* =========================
     Divers handlers
  ========================= */
  const resetForm = () => {
    setFormData(emptyForm);
    setIsLinked(false);
    setLinkedCommandeId(null);
    setSameMachineAsLinked(false);
    setStartAfterLinked(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette commande ?")) return;

    try {
      const { data: planningServeur, error: errorPlanningSelect } = await supabase
        .from("planning")
        .select("*")
        .eq("commandeId", id);
      if (errorPlanningSelect) {
        console.error("Erreur récupération planning:", errorPlanningSelect);
      }

      if (Array.isArray(planningServeur)) {
        for (const p of planningServeur) {
          const { error: errorDeletePlanning } = await supabase.from("planning").delete().eq("id", p.id);
          if (errorDeletePlanning) console.error("Erreur suppression planning:", errorDeletePlanning);
        }
      } else {
        console.warn("planningServeur n'est pas un tableau :", planningServeur);
      }

      const { error: deleteError } = await supabase.from("commandes").delete().eq("id", id);
      if (deleteError) {
        alert("Erreur lors de la suppression de la commande.");
        console.error(deleteError);
        return;
      }

      reloadData();
    } catch (err) {
      console.error("Erreur suppression:", err);
      alert("Erreur lors de la suppression.");
    }
  };

  const handleNewCommande = () => {
    resetForm();
    setShowModal(true);
    setSelectedScenario(null);
    setScenarios([]);
    setMachineAssignee(null);
    setConfirmCoef(350);
  };

  /* =========================
     Filtrage des options (zones) selon l'article choisi
  ========================= */
  const selectedArticleLabel = formData.types?.[0] ?? null;

  const allowedSet = useMemo(() => {
    if (!selectedArticleLabel) return null;
    return getAllowedBroderieForArticle(nettoyageRules, selectedArticleLabel);
  }, [nettoyageRules, selectedArticleLabel]);

  const filteredBroderieTags = useMemo(() => {
    if (!Array.isArray(broderieTags)) return [];
    if (!allowedSet || allowedSet.size === 0) return broderieTags; // avant config, tout afficher
    return broderieTags.filter((tag) => allowedSet.has(normalizeOne(tag.label)));
  }, [broderieTags, allowedSet]);

  /* =========================
     Rendu
  ========================= */
  return (
    <div className="commandes-page">
      <NewButton onClick={handleNewCommande}>Nouvelle commande</NewButton>

      {/* Modale création */}
      {showModal && !selectedScenario && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{formData.id ? "Modifier la commande" : "Nouvelle commande"}</h2>

            <form className="formulaire-commande" onSubmit={handleSubmit}>
              {/* ----- LIAISON A UNE COMMANDE EXISTANTE ----- */}
              <div className="bloc-liaison">
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={isLinked}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setIsLinked(val);
                      if (!val) {
                        setLinkedCommandeId(null);
                        setSameMachineAsLinked(false);
                        setStartAfterLinked(true);
                      }
                    }}
                  />
                  Cette commande est-elle liée à une commande existante ?
                </label>

                {isLinked && (
                  <>
                    <label>
                      Sélectionnez la commande liée :
                      <select
                        value={linkedCommandeId || ""}
                        onChange={(e) => setLinkedCommandeId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">-- choisir --</option>
                        {linkableCommandes
                          .filter((c) => !formData.id || c.id !== formData.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              #{c.numero} — {c.client} ({c.statut})
                            </option>
                          ))}
                      </select>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={sameMachineAsLinked}
                        onChange={(e) => setSameMachineAsLinked(e.target.checked)}
                        disabled={!linkedCommandeId}
                      />
                      Utiliser la même brodeuse (même machine) que la commande liée
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={startAfterLinked}
                        onChange={(e) => setStartAfterLinked(e.target.checked)}
                        disabled={!linkedCommandeId}
                      />
                      Planifier après la commande liée (enchaînement)
                    </label>
                  </>
                )}
              </div>

              {/* ----- INFOS COMMANDE ----- */}
              <label>
                Numéro de commande :
                <input type="text" name="numero" value={formData.numero} onChange={handleChange} required />
              </label>
              <label>
                Client :
                <input type="text" name="client" value={formData.client} onChange={handleChange} required />
              </label>
              <label>
                Quantité :
                <input type="number" name="quantite" value={formData.quantite} onChange={handleChange} min="1" required />
              </label>
              <label>
                Points :
                <input type="number" name="points" value={formData.points} onChange={handleChange} min="1" required />
              </label>
              <label>
                Vitesse moyenne (points/minute) :
                <input
                  type="number"
                  name="vitesseMoyenne"
                  value={formData.vitesseMoyenne}
                  onChange={handleChange}
                  placeholder="680"
                  min="1"
                />
              </label>
              <label>
                Date livraison :
                <input type="date" name="dateLivraison" value={formData.dateLivraison} onChange={handleDateChange} />
              </label>
              <label>
                Urgence :
                <select name="urgence" value={formData.urgence} onChange={handleChange}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <label>Types :</label>
              <div className="tags-container">
                {Array.isArray(articleTags) &&
                  articleTags.map((tag) => (
                    <button
                      key={tag.label}
                      type="button"
                      className={`tag ${formData.types.includes(tag.label) ? "active" : ""}`}
                      onClick={() => toggleTag("types", tag.label)}
                    >
                      {tag.label}
                    </button>
                  ))}
              </div>

              <label>Options :</label>
              <div className="tags-container">
                {Array.isArray(filteredBroderieTags) &&
                  filteredBroderieTags.map((tag) => (
                    <button
                      key={tag.id ?? tag.label}
                      type="button"
                      className={`tag ${formData.options.includes(tag.label) ? "active" : ""}`}
                      onClick={() => toggleTag("options", tag.label)}
                    >
                      {tag.label}
                    </button>
                  ))}
              </div>

              <button type="submit" className="btn-enregistrer">
                Enregistrer
              </button>
            </form>

            {saved && <div className="message-saved">✅ Enregistré</div>}
            <button className="btn-fermer" onClick={() => setShowModal(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modale choix machine + TEMPS RÉEL (pourcentage) */}
      {selectedScenario && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirmer la machine & le temps réel</h2>

            <p>
              <strong>Machine proposée :</strong> {selectedScenario.machine.nom}
            </p>

            <div className="grid-2cols" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <p>
                  <strong>Temps broderie (théorique) :</strong>{" "}
                  {convertHoursToHHMM(selectedScenario.dureeBroderieHeures)}
                </p>
                <p>
                  <strong>Temps nettoyage (théorique) :</strong>{" "}
                  {convertHoursToHHMM(selectedScenario.dureeNettoyageHeures)}
                </p>
                <p>
                  <strong>Temps total (théorique) :</strong>{" "}
                  {convertHoursToHHMM(selectedScenario.dureeTotaleHeuresReelle)}
                </p>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6 }}>Pourcentage appliqué (temps réel)</label>
                <div className="flex" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    className="px-3 py-2 border rounded-lg"
                    onClick={() => setConfirmCoef((c) => clampPercentToStep5(c - 5))}
                  >
                    – 5%
                  </button>

                  <input
                    type="number"
                    className="border rounded-lg px-3 py-2 w-28 text-right"
                    value={confirmCoef}
                    onChange={(e) => setConfirmCoef(clampPercentToStep5(parseInt(e.target.value || "0", 10)))}
                    step={5}
                    min={50}
                    max={500}
                  />
                  <span>%</span>

                  <button
                    type="button"
                    className="px-3 py-2 border rounded-lg"
                    onClick={() => setConfirmCoef((c) => clampPercentToStep5(c + 5))}
                  >
                    + 5%
                  </button>
                </div>

                <input
                  type="range"
                  className="w-full"
                  style={{ width: "100%", marginTop: 8 }}
                  min={50}
                  max={500}
                  step={5}
                  value={confirmCoef}
                  onChange={(e) => setConfirmCoef(parseInt(e.target.value, 10))}
                />

                <p style={{ marginTop: 10 }}>
                  <strong>Temps réel (appliqué) :</strong>{" "}
                  {convertHoursToHHMM(minutesReellesAppliquees / 60)}
                  {"  "}
                  <em style={{ opacity: 0.7 }}>
                    (arrondi 5 min • réservation ≈ {Math.ceil(minutesReellesAppliquees / 60)} h)
                  </em>
                </p>

                <p style={{ marginTop: 6 }}>
                  <strong>Fin estimée avec % :</strong>{" "}
                  {currentScenario
                    ? new Date(
                        computeProvisionalEnd(currentScenario.debut, minutesReellesAppliquees)
                      ).toLocaleString("fr-FR")
                    : "—"}
                </p>
              </div>
            </div>

            <label style={{ marginTop: 12, display: "block" }}>Choisir une autre machine :</label>
            <select
              value={machineAssignee ?? selectedScenario.machine.id}
              onChange={(e) => setMachineAssignee(e.target.value)}
            >
              {machines
                .filter((m) => {
                  const machineLabels = toLabelArray(m.etiquettes);
                  const neededTypes = toLabelArray(formData.types);
                  return neededTypes.every((t) => machineLabels.includes(t));
                })
                .map((m) => {
                  const sc = scenarioByMachineId.get(m.id);
                  // Fin estimée pour CHAQUE option de machine en tenant compte du %
                  const minTheoForOption = sc ? Math.round(Number(sc.dureeTotaleHeuresReelle || 0) * 60) : 0;
                  const minReelForOption = roundMinutesTo5(Math.round((minTheoForOption * confirmCoef) / 100));
                  const finAvecCoef = sc ? computeProvisionalEnd(sc.debut, minReelForOption) : null;
                  const finLabel = finAvecCoef
                    ? ` — fin estimée ${new Date(finAvecCoef).toLocaleString("fr-FR")}`
                    : "";

                  return (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                      {finLabel}
                    </option>
                  );
                })}
            </select>

            <button onClick={confirmCreation} style={{ marginTop: "12px" }}>
              Confirmer ce choix
            </button>
          </div>
        </div>
      )}

      {/* Liste des commandes */}
      <div className="liste-commandes">
        {commandes.map((cmd) => {
          // Couleur par statut (fond + liseré + badge)
          const theme = getStatusTheme(cmd.statut);

          // 1) Lire d'abord la DB (nouvelles colonnes)
          let b = cmd.duree_broderie_heures;   // théorique broderie
          let n = cmd.duree_nettoyage_heures;  // théorique nettoyage
          let t = cmd.duree_totale_heures;     // "réel appliqué" (après %)

          // 2) Fallback pour anciennes commandes (colonnes nulles)
          if (b == null || n == null || t == null) {
            const etiquetteArticle = cmd.types?.[0] || null;

            // 🔹 Nettoyage via règles (somme des zones) ou fallback
            const nettoyageSec = computeNettoyageSecondsForOrder(
              etiquetteArticle,
              cmd.options,
              nettoyageRules,
              articleTags
            );

            const quantite = Number(cmd.quantite || 0);
            const points = Number(cmd.points || 0);
            const nbTetes = Number(machines.find((m) => m.nom === cmd.machineAssignee)?.nbTetes || 1);
            const vitessePPM = Number(cmd.vitesseMoyenne || 680); // PPM

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

          // Estimation du coef affiché (si possible)
          const theoriqueTotal = (Number(b) || 0) + (Number(n) || 0);
          const coefAffiche =
            theoriqueTotal > 0 ? clampPercentToStep5(Math.round((Number(t || 0) / theoriqueTotal) * 100)) : null;

          const debutLabel = cmd.started_at ? new Date(cmd.started_at).toLocaleString("fr-FR") : null;
          const finLabel = cmd.finished_at ? new Date(cmd.finished_at).toLocaleString("fr-FR") : null;

          return (
            <div
              key={cmd.id}
              className="carte-commande"
              style={{
                backgroundColor: theme.bgSoft,
                borderLeft: `6px solid ${theme.border}`,
                border: "1px solid #e0e0e0",
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="carte-commande__header"
                style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}
              >
                <h3 style={{ margin: 0 }}>Commande #{cmd.numero}</h3>
                <StatusBadge statut={cmd.statut || "A commencer"} />
              </div>

              <p>
                <strong>Client :</strong> {cmd.client}
              </p>
              <p>
                <strong>Quantité :</strong> {cmd.quantite}
              </p>
              <p>
                <strong>Points :</strong> {cmd.points}
              </p>
              <p>
                <strong>Urgence :</strong> {cmd.urgence}
              </p>
              <p>
                <strong>Livraison :</strong> {cmd.dateLivraison}
              </p>

              <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong>Statut :</strong>{" "}
                <StatusBadge statut={cmd.statut || "A commencer"} size="sm" />
                <select
                  value={cmd.statut || "A commencer"}
                  onChange={(e) => handleChangeStatut(cmd.id, e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1px solid ${theme.border}`,
                    backgroundColor: "#fff",
                    color: "#333",
                    outlineColor: theme.border,
                  }}
                >
                  {STATUTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </p>

              {debutLabel && (
                <p>
                  <strong>Début de commande :</strong> {debutLabel}
                </p>
              )}
              {finLabel && (
                <p>
                  <strong>Fin de commande :</strong> {finLabel}
                </p>
              )}

              {cmd.machineAssignee && (
                <p>
                  <strong>Machine :</strong> {cmd.machineAssignee}
                </p>
              )}

              {(cmd.linked_commande_id || cmd.same_machine_as_linked || cmd.start_after_linked) && (
                <div className="bloc-liaison-info">
                  <strong>Liaison :</strong>{" "}
                  {cmd.linked_commande_id ? `#${cmd.linked_commande_id}` : "—"} •{" "}
                  {cmd.same_machine_as_linked ? "même brodeuse" : "brodeuse libre"} •{" "}
                  {cmd.start_after_linked ? "enchaînée après" : "non enchaînée"}
                </div>
              )}

              <p>
                <strong>Durée broderie (théorique) :</strong> {convertDecimalToTime(b ?? 0)}
              </p>
              <p>
                <strong>Durée nettoyage (théorique) :</strong> {convertDecimalToTime(n ?? 0)}
              </p>
              <p>
                <strong>Durée totale (réelle appliquée) :</strong> {convertDecimalToTime(t ?? 0)}
                {coefAffiche ? <em style={{ marginLeft: 6, opacity: 0.7 }}>({coefAffiche}% appliqué)</em> : null}
              </p>

              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setFormData({
                      ...cmd,
                      id: cmd.id,
                      quantite: String(cmd.quantite),
                      points: String(cmd.points),
                      urgence: String(cmd.urgence),
                    });
                    setIsLinked(Boolean(cmd.linked_commande_id));
                    setLinkedCommandeId(cmd.linked_commande_id || null);
                    setSameMachineAsLinked(Boolean(cmd.same_machine_as_linked));
                    setStartAfterLinked(Boolean(cmd.start_after_linked ?? true));

                    setSaved(false);
                    setShowModal(true);
                    setSelectedScenario(null);
                    setScenarios([]);
                    setMachineAssignee(null);
                    setConfirmCoef(350);
                  }}
                  className="btn-enregistrer"
                  style={{ borderRadius: 8 }}
                >
                  Modifier
                </button>
                <button onClick={() => handleDelete(cmd.id)} className="btn-fermer" style={{ borderRadius: 8 }}>
                  Supprimer
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Commandes;
