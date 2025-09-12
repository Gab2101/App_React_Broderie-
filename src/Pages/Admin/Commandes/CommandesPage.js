// src/Pages/Admin/Commandes/CommandesPage.jsx
import React, { useContext, useState } from "react";
import "../../../styles/Commandes.css";

import NewButton from "../../../components/common/NewButton";
import { EtiquettesContext } from "../../../context/EtiquettesContext";

import CommandeFormModal from "./components/CommandeFormModal";
import MachineAndTimeConfirmModal from "./components/MachineAndTimeConfirmModal";
import MultiMachineConfirmModal from "./components/MultiMachineConfirmModal";
import CommandeCard from "./components/CommandeCard";

import useCommandesData from "./hooks/useCommandesData";
import useForm from "./hooks/useForm";
import useLinkedCommande from "./hooks/useLinkedCommande";
import useSimulation from "./hooks/useSimulation";
import useStatut from "./hooks/useStatut";
import { groupAndSortByMachine } from "./utils/grouping";

import {
  parseLocalDatetime,
  toUTCISOString,
  snapToNextWorkStart,
  addMinutesWithinWorkHours,
  DEFAULT_WORKDAY,
} from "./utils/workhours";

import {
  createCommandeAndPlanning,
  updateCommande as apiUpdateCommande,
  deleteCommandeWithPlanning,
} from "./services/commandesApi";
import { createCommandeWithAssignations } from "./services/assignationsApi";

export default function CommandesPage() {
  // Étiquettes (context)
  const { articleTags, broderieTags } = useContext(EtiquettesContext);

  // Données distantes + reload
  const {
    commandes,
    setCommandes,
    machines,
    planning,
    nettoyageRules,
    linkableCommandes,
    reloadData,
  } = useCommandesData();

  // État formulaire + lien commande
  const form = useForm();
  const linked = useLinkedCommande({ planning, commandes, machines });

  // Simulation (durées / scénarios)
  const sim = useSimulation({
    formData: form.formData,
    machines,
    planning,
    nettoyageRules,
    articleTags,
    linked: {
      isLinked: linked.isLinked,
      linkedCommandeId: linked.linkedCommandeId,
      sameMachineAsLinked: linked.sameMachineAsLinked,
      startAfterLinked: linked.startAfterLinked,
    },
  });

  // Statuts
  const { STATUTS, handleChangeStatut } = useStatut({ commandes, setCommandes });

  // UI & flux de création
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false); // mono
  const [isSubmitting, setIsSubmitting] = useState(false);

  // "idle" | "mono" | "multi"
  const [creationFlow, setCreationFlow] = useState("idle");

  // Confirmation MULTI
  const [isMultiConfirmOpen, setIsMultiConfirmOpen] = useState(false);
  const [pendingMultiPayload, setPendingMultiPayload] = useState(null);

  /* =========================
     A. États & UX de recherche
     ========================= */
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchRef = React.useRef(null);

  // Debounce 250 ms
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  // Raccourci clavier "/" pour focus
  React.useEffect(() => {
    const onKeydown = (e) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  /* =========================
     B. Filtrage client
     ========================= */
  const matchesQuery = (c, q) => {
    if (!q) return true;
    const haystack = [
      c.id,
      c.reference,
      c.numeroCommande,
      c.numero,
      c.nomClient,
      c.client,
      c.article,
      c.statut,
      c.commentaire,
      Array.isArray(c.tags) ? c.tags.join(" ") : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q.toLowerCase());
  };

  const filteredCommandes = React.useMemo(
    () => (commandes || []).filter((c) => matchesQuery(c, debouncedQuery)),
    [commandes, debouncedQuery]
  );

  // Étape 1 : groupage + tri (sur la liste filtrée)
  const machineBuckets = React.useMemo(
    () => groupAndSortByMachine(filteredCommandes),
    [filteredCommandes]
  );

  // -- Helpers de flux --
  const resetCreationState = () => {
    form.resetForm();

    linked.setIsLinked(false);
    linked.setLinkedCommandeId(null);
    linked.setSameMachineAsLinked(false);
    linked.setStartAfterLinked(true);

    sim.setSelectedScenario(null);
    sim.setMachineAssignee(null);
    sim.setConfirmCoef(200);
    sim.setMonoUnitsUsed(1);

    setIsConfirmOpen(false);
    setIsMultiConfirmOpen(false);
    setPendingMultiPayload(null);
    setCreationFlow("idle");
  };

  const openFormForNew = () => {
    resetCreationState();
    setIsFormOpen(true);
  };

  const openFormForEdit = (cmd) => {
    form.setFormData({
      ...cmd,
      id: cmd.id,
      quantite: String(cmd.quantite),
      points: String(cmd.points),
      urgence: String(cmd.urgence),
    });

    linked.setIsLinked(Boolean(cmd.linked_commande_id));
    linked.setLinkedCommandeId(cmd.linked_commande_id || null);
    linked.setSameMachineAsLinked(Boolean(cmd.same_machine_as_linked));
    linked.setStartAfterLinked(Boolean(cmd.start_after_linked ?? true));

    form.setSaved(false);
    sim.setSelectedScenario(null);
    sim.setMachineAssignee(null);
    sim.setConfirmCoef(200);
    sim.setMonoUnitsUsed(Number(cmd.mono_units_used || 1));

    setIsFormOpen(true);
  };

  // Soumission formulaire (création/édition)
  const handleSubmitForm = async (config) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const qty = parseInt(form.formData.quantite, 10);
      const pts = parseInt(form.formData.points, 10);
      if (!Number.isFinite(qty) || !Number.isFinite(pts) || qty <= 0 || pts <= 0) {
        alert("La quantité et le nombre de points doivent être supérieurs à zéro.");
        return;
      }

      // ÉDITION
      if (form.formData.id) {
        const { error } = await apiUpdateCommande(form.formData);
        if (error) {
          console.error(error);
          alert("Erreur lors de la mise à jour.");
          return;
        }
        await reloadData();
        form.resetForm();
        setIsFormOpen(false);
        return;
      }

      // CRÉATION : MULTI prioritaire
      if (config?.flow === "multi") {
        const list = Array.isArray(config.perMachine) ? config.perMachine : [];
        const validList = list.filter((r) => r && r.machineId && Number(r.quantity) > 0);
        if (validList.length < 2) {
          alert("Sélectionnez au moins 2 machines avec des quantités > 0.");
          return;
        }

        setCreationFlow("multi");
        setPendingMultiPayload({
          perMachine: validList,
          meta: config.meta || null,
          plannedStartISO:
            config.plannedStartISO ||
            (form.formData?.date_debut_planning
              ? toUTCISOString(parseLocalDatetime(form.formData.date_debut_planning))
              : toUTCISOString(snapToNextWorkStart(new Date(), DEFAULT_WORKDAY))),
        });

        setIsFormOpen(false);
        setIsConfirmOpen(false);
        setIsMultiConfirmOpen(true);
        return;
      }

      // CRÉATION : MONO
      if (config?.flow === "mono") {
        if (creationFlow === "multi") return; // sécurité

        await sim.handleSimulation();
        if (sim.selectedScenario) {
          setCreationFlow("mono");
          setIsFormOpen(false);
          setIsConfirmOpen(true);
        }
        return;
      }

      console.warn("[handleSubmitForm] Appel ignoré : payload inattendu", config);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enregistrement final MULTI
  const handleConfirmMultiSave = async ({
    perMachine,
    meta,
    plannedStartLocal,
    respectWorkHours,
  }) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      let baseLocal = parseLocalDatetime(plannedStartLocal);
      if (respectWorkHours) baseLocal = snapToNextWorkStart(baseLocal, DEFAULT_WORKDAY);

      const enriched = perMachine.map((r) => {
        const dur = Number(r.durationCalcMinutes || r.durationTheoreticalMinutes || 0) || 0;
        const { end } = respectWorkHours
          ? addMinutesWithinWorkHours(baseLocal, dur, DEFAULT_WORKDAY)
          : { end: new Date(baseLocal.getTime() + dur * 60000) };
        return {
          ...r,
          planned_start_iso_utc: toUTCISOString(baseLocal),
          planned_end_iso_utc: toUTCISOString(end),
        };
      });

      const { errorCmd, errorAssign } = await createCommandeWithAssignations({
        formData: {
          ...form.formData,
          linked_commande_id: linked.linkedCommandeId,
          same_machine_as_linked: linked.sameMachineAsLinked,
          start_after_linked: linked.startAfterLinked,
        },
        perMachine: enriched.map((r) => ({
          machineId: r.machineId,
          quantity: r.quantity,
          durationTheoreticalMinutes: r.durationTheoreticalMinutes,
          durationCalcMinutes: r.durationCalcMinutes,
          planned_start: r.planned_start_iso_utc,
          planned_end: r.planned_end_iso_utc,
        })),
        meta,
        plannedStartISO: null,
      });

      if (errorCmd || errorAssign) {
        console.error("Erreur création multi-machines:", errorCmd || errorAssign);
        alert("Erreur lors de la création (multi-machines).");
        return;
      }

      setIsMultiConfirmOpen(false);
      setPendingMultiPayload(null);
      setCreationFlow("idle");

      await reloadData();
      form.resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enregistrement final MONO
  const handleConfirmCreation = async ({ machineId, coef, monoUnitsUsed }) => {
    const machine = machines.find((m) => String(m.id) === String(machineId));
    if (!machine) {
      alert("Machine invalide.");
      return;
    }

    const { errorCmd, errorPlanning } = await createCommandeAndPlanning({
      formData: form.formData,
      machine,
      coef,
      monoUnitsUsed,
      planning,
      commandes,
      machines,
      nettoyageRules,
      articleTags,
      linked: {
        isLinked: linked.isLinked,
        linkedCommandeId: linked.linkedCommandeId,
        sameMachineAsLinked: linked.sameMachineAsLinked,
        startAfterLinked: linked.startAfterLinked,
      },
    });

    if (errorCmd) {
      console.error("Erreur création commande:", errorCmd);
      alert(
        "Erreur lors de la création de la commande.\n" +
          (errorCmd.message || "Regarde la console.")
      );
      return;
    }

    if (errorPlanning) {
      console.error("Erreur création planning:", errorPlanning);
      alert(
        "La commande a été créée, mais l'insertion dans le planning a échoué.\n" +
          (errorPlanning.message || "")
      );
    }

    sim.setSelectedScenario(null);
    sim.setMachineAssignee(null);
    sim.setConfirmCoef(200);
    sim.setMonoUnitsUsed(1);

    setIsConfirmOpen(false);
    setCreationFlow("idle");

    await reloadData();
    form.resetForm();
  };

  // Suppression
  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette commande ?")) return;
    const { error } = await deleteCommandeWithPlanning(id);
    if (error) {
      console.error(error);
      alert("Erreur lors de la suppression de la commande.");
      return;
    }
    await reloadData();
  };

  // Garde-fou : empêcher 2 "En cours" sur une même machine
  const safeChangeStatut = (id, nextStatut) => {
    try {
      const current = commandes.find((c) => String(c.id) === String(id));
      if (!current) return;

      if (nextStatut === "En cours") {
        const machine =
          current.machineAssignee || current.machine || current.machine_id || null;

        if (!machine) {
          alert(
            "Impossible de passer en « En cours » : assignez d'abord une machine à la commande."
          );
          return;
        }

        const conflict = commandes.find(
          (c) =>
            String(c.id) !== String(id) &&
            (c.machineAssignee === machine ||
              c.machine === machine ||
              c.machine_id === machine) &&
            c.statut === "En cours"
        );

        if (conflict) {
          const label = conflict.numero ? `#${conflict.numero}` : String(conflict.id);
          alert(
            `Conflit : la machine « ${machine} » a déjà une commande en cours (${label}).\n` +
              `Terminez-la d'abord avant d'en lancer une autre.`
          );
          return;
        }
      }

      handleChangeStatut(id, nextStatut);
    } catch (e) {
      console.error("safeChangeStatut error", e);
    }
  };

  /* =========================
     Étape 2 + 3 : sections + barre colorée
     ========================= */

  // 1) Trouver la machine à partir de la clé d'un bucket
  const findMachineByKey = (key) => {
    if (!key) return null;
    let m = (machines || []).find((mm) => String(mm.id) === String(key));
    if (m) return m;
    m = (machines || []).find(
      (mm) =>
        String(mm.nom)?.toLowerCase() === String(key).toLowerCase() ||
        String(mm.name)?.toLowerCase() === String(key).toLowerCase() ||
        String(mm.label)?.toLowerCase() === String(key).toLowerCase()
    );
    return m || null;
  };

  const getMachineLabel = (key) => {
    const m = findMachineByKey(key);
    return m?.nom || m?.name || m?.label || String(key);
  };

  // 2) Couleur de la machine (barre sous le titre)
  const getMachineColor = (key) => {
    const m = findMachineByKey(key);
    if (!m) return "var(--border, #e5e7eb)";

    // Hex explicite
    const hex =
      m.couleur_hex || m.color_hex || m.hex || m.accentHex || m.badgeHex || null;
    if (typeof hex === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
      return hex;
    }

    // Noms usuels
    const raw =
      m.couleur || m.color || m.badgeColor || m.accent || m.teinte || m.theme || "";
    const name = String(raw).trim().toLowerCase();
    const MAP = {
      rose: "#E91E63",
      roseclair: "#F48FB1",
      rosepale: "#F8BBD0",
      rouge: "#B71C21",
      vert: "#22C55E",
      verte: "#22C55E",
      orange: "#FB923C",
      bleu: "#3B82F6",
      violet: "#8B5CF6",
      jaune: "#F59E0B",
      gris: "#9CA3AF",
    };
    return MAP[name] || "var(--border, #e5e7eb)";
  };

  // 3) Ordre des sections : suivre `machines`, puis les clés restantes
  const bucketKeys = React.useMemo(() => Array.from(machineBuckets.keys()), [machineBuckets]);

  const orderedSectionKeys = React.useMemo(() => {
    const keys = [];
    for (const m of machines || []) {
      const candidates = [String(m.id), m.nom, m.name, m.label].filter(Boolean).map(String);
      const match = bucketKeys.find((k) =>
        candidates.some((c) => c.toLowerCase() === String(k).toLowerCase())
      );
      if (match && !keys.includes(match)) keys.push(match);
    }
    for (const k of bucketKeys) {
      if (!keys.includes(k)) keys.push(k);
    }
    return keys;
  }, [machines, bucketKeys]);

  // --- Rendu ---
  return (
    <div className="commandes-page">
      <NewButton onClick={openFormForNew} disabled={isSubmitting}>
        Nouvelle commande
      </NewButton>

      {/* BARRE DE RECHERCHE */}
      <div className="commandes-search">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Rechercher (client, réf, article, statut, tags…) — tape "/"'
          aria-label="Rechercher une commande"
        />
        {query && (
          <button
            className="clear-btn"
            onClick={() => setQuery("")}
            aria-label="Effacer la recherche"
            title="Effacer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Formulaire (création / édition) */}
      <CommandeFormModal
        isOpen={isFormOpen}
        onClose={() => !isSubmitting && setIsFormOpen(false)}
        onSubmit={handleSubmitForm}
        formData={form.formData}
        handleChange={form.handleChange}
        handleDateChange={form.handleDateChange}
        toggleTag={form.toggleTag}
        saved={form.saved}
        isLinked={linked.isLinked}
        setIsLinked={linked.setIsLinked}
        linkedCommandeId={linked.linkedCommandeId}
        setLinkedCommandeId={linked.setLinkedCommandeId}
        sameMachineAsLinked={linked.sameMachineAsLinked}
        setSameMachineAsLinked={linked.setSameMachineAsLinked}
        startAfterLinked={linked.startAfterLinked}
        setStartAfterLinked={linked.setStartAfterLinked}
        linkableCommandes={linkableCommandes}
        articleTags={articleTags}
        broderieTags={broderieTags}
        machines={machines}
        isEditing={Boolean(form.formData?.id)}
      />

      {/* Confirmation MONO */}
      <MachineAndTimeConfirmModal
        isOpen={isConfirmOpen && creationFlow !== "multi"}
        onClose={() => !isSubmitting && setIsConfirmOpen(false)}
        machines={machines}
        formData={form.formData}
        selectedScenario={sim.selectedScenario}
        scenarioByMachineId={sim.scenarioByMachineId}
        currentScenario={sim.currentScenario}
        confirmCoef={sim.confirmCoef}
        setConfirmCoef={sim.setConfirmCoef}
        minutesReellesAppliquees={sim.minutesReellesAppliquees}
        machineAssignee={sim.machineAssignee}
        setMachineAssignee={sim.setMachineAssignee}
        monoUnitsUsed={sim.monoUnitsUsed}
        setMonoUnitsUsed={sim.setMonoUnitsUsed}
        onConfirm={({ machineId, coef, monoUnitsUsed }) =>
          handleConfirmCreation({ machineId, coef, monoUnitsUsed })
        }
      />

      {/* Confirmation MULTI */}
      <MultiMachineConfirmModal
        isOpen={isMultiConfirmOpen && creationFlow === "multi"}
        onClose={() => !isSubmitting && setIsMultiConfirmOpen(false)}
        onSubmit={handleSubmitForm}
        payload={pendingMultiPayload}
        machines={machines}
        onConfirm={handleConfirmMultiSave}
      />

      {/* Sections par machine */}
      <div className="sections-container">
        {orderedSectionKeys.map((key) => {
          const list = machineBuckets.get(key) || [];
          if (!list.length) return null;

          const label = getMachineLabel(key);

          return (
            <section key={key} className="machine-section">
              {/* En-tête de section */}
              <header className="machine-section-header">
                <h2 className="machine-section-title">
                  {label}
                  <span className="count-badge">{list.length}</span>
                </h2>

                {/* Barre colorée */}
                <div
                  className="machine-accent"
                  style={{ backgroundColor: getMachineColor(key) }}
                  aria-hidden="true"
                />
              </header>

              {/* Liste des cartes de la machine */}
              <div className="cards-grid">
                {list.map((cmd) => (
                  <CommandeCard
                    key={cmd.id}
                    cmd={cmd}
                    STATUTS={STATUTS}
                    onChangeStatut={(id, statut) => safeChangeStatut(id, statut)}
                    onEdit={openFormForEdit}
                    onDelete={handleDelete}
                    machines={machines}
                    articleTags={articleTags}
                    nettoyageRules={nettoyageRules}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* État vide quand la recherche ne retourne rien */}
        {orderedSectionKeys.length === 0 && debouncedQuery && (
          <div className="muted" style={{ marginTop: 8 }}>
            Aucune commande ne correspond à « {debouncedQuery} ».
          </div>
        )}
      </div>
    </div>
  );
}
