// src/Pages/Admin/Commandes/CommandesPage.jsx
import React, { useContext, useState, useCallback } from "react";
import "../../../styles/Commandes.css";

import NewButton from "@/components/common/NewButton.jsx";
import { EtiquettesContext } from "@/context/EtiquettesContext.jsx";

import CommandeFormModal from "./components/CommandeFormModal.jsx";
import MachineAndTimeConfirmModal from "./components/MachineAndTimeConfirmModal.jsx";
import MultiMachineConfirmModal from "./components/MultiMachineConfirmModal.jsx";
import CommandeCard from "./components/CommandeCard.jsx";

import useCommandesData from "./hooks/useCommandesData";
import useForm from "./hooks/useForm";
import useLinkedCommande from "./hooks/useLinkedCommande";
import useSimulation from "./hooks/useSimulation";
import useStatut from "./hooks/useStatut";
import { groupAndSortByMachine, groupByMachineAndDate } from "./utils/grouping";

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
import supabase from '@/lib/supabaseClient' // ✅ pour la MAJ "déballé"

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

  // Archive toggle for finished orders
  const [showArchive, setShowArchive] = useState(false);

  /* =========================
     A. États & UX de recherche + filtrage date
     ========================= */
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const searchRef = React.useRef(null);

  // Date filtering
  const [dateFilter, setDateFilter] = useState({
    enabled: false,
    startDate: '',
    endDate: '',
  });

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

  const filteredCommandes = React.useMemo(() => {
    let filtered = (commandes || []).filter(c =>
      matchesQuery(c, debouncedQuery) && c.statut !== "Terminée"
    );

    // Apply date filtering if enabled
    if (dateFilter.enabled && (dateFilter.startDate || dateFilter.endDate)) {
      const startDate = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
      const endDate = dateFilter.endDate ? new Date(dateFilter.endDate) : null;

      filtered = filtered.filter(c => {
        if (!c.dateLivraison) return dateFilter.startDate === '' && dateFilter.endDate === '';

        const livraisonDate = new Date(c.dateLivraison);

        if (startDate && endDate) {
          return livraisonDate >= startDate && livraisonDate <= endDate;
        } else if (startDate) {
          return livraisonDate >= startDate;
        } else if (endDate) {
          return livraisonDate <= endDate;
        }

        return false;
      });
    }

    return filtered;
  }, [commandes, debouncedQuery, dateFilter]);

  // Étape 1 : groupage conditionnel - machine seule par défaut, ou machine+date si filtre date actif
  const machineBuckets = React.useMemo(
    () => dateFilter.enabled
      ? groupByMachineAndDate(filteredCommandes)  // Avec sous-groupes par date
      : groupAndSortByMachine(filteredCommandes),  // Par machine seulement
    [filteredCommandes, dateFilter.enabled]
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
    // Set default values for new order
    form.setFormData({
      quantite: 5000,           // Default quantity
      points: 5000,              // Default points count
      vitesseMoyenne: 750,       // Default 750 points per minute
      urgence: 3,                // Default medium priority
      client: '',
      numero: '',
      types: [],
      options: [],
      dateLivraison: '',
      deballe: false,
    });
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
  const handleSubmitForm = async (formData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const qty = parseInt(formData.quantite, 10);
      const pts = parseInt(formData.points, 10);

      // More robust validation - handle empty strings, undefined, null
      if (isNaN(qty) || !Number.isFinite(qty) || qty <= 0 ||
          isNaN(pts) || !Number.isFinite(pts) || pts <= 0) {
        alert(`La quantité et le nombre de points doivent être supérieurs à zéro.`);
        return;
      }

      // ÉDITION
      if (formData.id) {
        const { error } = await apiUpdateCommande(formData);
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

      // CRÉATION : Par défaut MONO (multi-machines removed)
      // Update form data with submitted values for simulation
      form.setFormData(formData);

      await sim.handleSimulation();
      if (sim.selectedScenario) {
        setCreationFlow("mono");
        setIsFormOpen(false);
        setIsConfirmOpen(true);
      } else {
        alert("Impossible de créer la commande - aucun scénario disponible.");
      }
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
  const safeChangeStatut = useCallback((id, nextStatut) => {
    try {
      // Early validation
      if (!id || !nextStatut) return;

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

      // Final check before calling
      if (typeof handleChangeStatut === 'function') {
        handleChangeStatut(id, nextStatut);
      } else {
        console.error('[CommandesPage] handleChangeStatut is not a function');
      }
    } catch (e) {
      console.error("safeChangeStatut error:", e);
    }
  }, [commandes, handleChangeStatut]);

  /* =========================
     Toggle "déballé" (persistant)
     ========================= */
  const handleToggleDeballe = async (id, deballe) => {
    // UI optimiste (snapshot pour rollback)
    const prev = commandes;
    setCommandes((list) =>
      list.map((c) => (String(c.id) === String(id) ? { ...c, deballe } : c))
    );

    try {
      const { data, error } = await supabase
        .from("commandes")
        .update({ deballe })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Optionnel : réappliquer la ligne retournée (source de vérité)
      setCommandes((list) =>
        list.map((c) => (String(c.id) === String(id) ? { ...c, ...data } : c))
      );
    } catch (e) {
      console.error("MAJ deballe échouée", e);
      setCommandes(prev); // rollback
      alert("Impossible d'enregistrer le statut « déballé ». Réessaie.");
    }
  };

  /* =========================
     Toggle "validation client" (persistant)
     ========================= */
  const handleToggleValidation = async (id, validated) => {
    // UI optimiste (snapshot pour rollback)
    const prev = commandes;
    setCommandes((list) =>
      list.map((c) => (String(c.id) === String(id) ? { ...c, validation_client: validated } : c))
    );

    try {
      const { data, error } = await supabase
        .from("commandes")
        .update({ validation_client: validated })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Optionnel : réappliquer la ligne retournée (source de vérité)
      setCommandes((list) =>
        list.map((c) => (String(c.id) === String(id) ? { ...c, ...data } : c))
      );
    } catch (e) {
      console.error("MAJ validation_client échouée", e);
      setCommandes(prev); // rollback
      alert("Impossible d'enregistrer la validation client. Réessaie.");
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

  const getMachineLabel = (key, orderCount = 0) => {
    const m = findMachineByKey(key);
    const machineName = m?.nom || m?.name || m?.label || String(key);
    return `${machineName} (${orderCount > 1 ? orderCount + ' commandes' : '1 commande'})`;
  };

  // 2) Couleur de la machine (barre sous le titre + cartes)
  // Color utility functions
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgbToHex = (r, g, b) => "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");

  const blendColors = (color1, color2) => {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    if (!rgb1 || !rgb2) return color1;

    return rgbToHex(
      (rgb1.r + rgb2.r) / 2,
      (rgb1.g + rgb2.g) / 2,
      (rgb1.b + rgb2.b) / 2
    );
  };

  // Enhanced color function that considers machine groups
  const getMachineColor = (key) => {
    const m = findMachineByKey(key);
    if (!m) return "#ffffff"; // Default white

    // Check if machine belongs to a group - if so, use group-based coloring
    const groupLabel = m.group_label;
    if (groupLabel) {
      // For group-based coloring, create consistent colors based on group
      // Use a simple hash of group name to generate colors
      const hash = groupLabel.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const hue = hash % 360; // Distribute across color wheel
      const saturation = 65; // Medium saturation
      const lightness = 75;  // Light background

      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    // Fall back to machine-specific color logic
    // Hex explicite
    const hex =
      m.couleur_hex || m.color_hex || m.hex || m.accentHex || m.badgeHex || m.badge_hex || null;
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
    return MAP[name] || "#ffffff"; // Default white
  };

  // 3) Ordre des sections : suivre `machines`, puis les clés restantes
  const machineKeys = React.useMemo(() => Array.from(machineBuckets.keys()), [machineBuckets]);

  const orderedMachineKeys = React.useMemo(() => {
    const keys = [];
    for (const m of machines || []) {
      const candidates = [String(m.id), m.nom, m.name, m.label].filter(Boolean).map(String);
      const match = machineKeys.find((k) =>
        candidates.some((c) => c.toLowerCase() === String(k).toLowerCase())
      );
      if (match && !keys.includes(match)) keys.push(match);
    }
    for (const k of machineKeys) {
      if (!keys.includes(k)) keys.push(k);
    }
    return keys;
  }, [machines, machineKeys]);

  // --- Rendu ---
  return (
    <div className="commandes-page">
      {/* Enhanced search bar - sticky positioned for better accessibility */}
      <div className="commandes-search-sticky">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', maxWidth: '1200px', margin: '0 auto', padding: '0 16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Rechercher (client, réf, article, statut, tags…) — tape "/"'
              aria-label="Rechercher une commande"
              style={{
                width: '100%',
                padding: '10px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = '#007bff'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {query && (
            <button
              className="clear-btn"
              onClick={() => setQuery("")}
              aria-label="Effacer la recherche"
              title="Effacer"
              style={{
                padding: '10px 16px',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
            >
              ✕ Effacer
            </button>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <NewButton onClick={openFormForNew} disabled={isSubmitting}>
              Nouvelle commande
            </NewButton>
          </div>
        </div>
      </div>

      {/* FILTRE PAR DATE */}
      <div style={{
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
      }}>
        <label style={{
          fontWeight: '500',
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <input
            type="checkbox"
            checked={dateFilter.enabled}
            onChange={(e) => setDateFilter(prev => ({
              ...prev,
              enabled: e.target.checked
            }))}
          />
          Filtrer par date de livraison
        </label>

        {dateFilter.enabled && (
          <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', color: '#6b7280' }}>
                Du:
              </label>
              <input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) => setDateFilter(prev => ({
                  ...prev,
                  startDate: e.target.value
                }))}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', color: '#6b7280' }}>
                Au:
              </label>
              <input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter(prev => ({
                  ...prev,
                  endDate: e.target.value
                }))}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            {(dateFilter.startDate || dateFilter.endDate) && (
              <button
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                onClick={() => setDateFilter(prev => ({
                  ...prev,
                  startDate: '',
                  endDate: '',
                }))}
              >
                Effacer dates
              </button>
            )}
          </>
        )}

        {dateFilter.enabled && (dateFilter.startDate || dateFilter.endDate) && (
          <div style={{
            fontSize: '14px',
            color: '#059669',
            fontWeight: '500',
          }}>
            Filtre actif: {dateFilter.startDate || '...'} → {dateFilter.endDate || '...'}
          </div>
        )}
      </div>

      {/* Formulaire (création / édition) */}
      <CommandeFormModal
        isOpen={isFormOpen}
        onClose={() => !isSubmitting && setIsFormOpen(false)}
        onSave={handleSubmitForm}
        commande={form.formData}
        linkedCommandeId={linked.linkedCommandeId}
        setLinkedCommandeId={linked.setLinkedCommandeId}
        linkableCommandes={linkableCommandes}
        articleTags={articleTags}
        broderieTags={broderieTags}
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

      {/* Sections par machine avec sous-sections par date */}
      <div className="sections-container">
        {orderedMachineKeys.map((machineKey) => {
          const machineData = machineBuckets.get(machineKey);
          if (!machineData || machineData.size === 0) return null;

          // Check if this is dual-level (machine + date) or single-level (machine only)
          const isDualLevelGrouping = typeof machineData.get === 'function' && machineData.constructor === Map;

          let orders = [];
          let totalOrders = 0;

          if (isDualLevelGrouping) {
            // Dual-level: machine + date groups
            orders = Array.from(machineData.values()).flat();
            totalOrders = orders.length;
          } else {
            // Single-level: direct array of orders
            orders = machineData;
            totalOrders = orders.length;
          }

          const machineLabel = getMachineLabel(machineKey, totalOrders);

          // Récupérer le group_label de la machine pour data-group
          const machineObj = findMachineByKey(machineKey);
          const groupLabel = machineObj?.group_label || machineKey;

          return (
            <section key={machineKey} className="machines-group" data-group={groupLabel}>
              {/* En-tête de section machine */}
              <header className="machines-group__header">
                <h2 className="machines-group__title">
                  {machineLabel}
                </h2>

                {/* Barre colorée - maintenant contrôlée par CSS data-group */}
                <div
                  className="machines-group__colorbar"
                  aria-hidden="true"
                />
              </header>

              {isDualLevelGrouping ? (
                /* Dual-level: Sous-sections par date */
                Array.from(machineData.entries()).map(([dateKey, dateOrders]) => {
                  if (!dateOrders || dateOrders.length === 0) return null;

                  const dateLabel = dateKey === 'Date inconnue'
                    ? 'Date inconnue'
                    : new Date(dateKey + 'T00:00:00').toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      });

                  const ordersLabel = dateOrders.length === 1 ? '1 commande' : `${dateOrders.length} commandes`;

                  return (
                    <div key={dateKey} className="date-subgroup">
                      {/* En-tête de sous-section date */}
                      <header className="date-subgroup__header">
                        <h3 className="date-subgroup__title">
                          {dateLabel} ({ordersLabel})
                        </h3>
                      </header>

                      {/* Liste des cartes pour cette date */}
                      <div className="cards-grid">
                        {dateOrders.map((cmd) => {
                          // Formater la date de livraison (UTC vers Europe/Paris)
                          const livraisonLabel = cmd.dateLivraison
                            ? new Date(cmd.dateLivraison).toLocaleDateString('fr-FR', {
                                timeZone: 'Europe/Paris',
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              })
                            : null;

                          // Get machine color for this order
                          const machineColor = getMachineColor(machineKey);

                          return (
                            <CommandeCard
                              key={cmd.id}
                              commande={cmd}
                              machineColor={machineColor}
                              onStatusChange={(id, statut) => safeChangeStatut(id, statut)}
                              onEdit={(commande) => openFormForEdit(commande)}
                              onDelete={handleDelete}
                              onDeballeChange={(id, checked) => handleToggleDeballe(id, checked)}
                              onValidationChange={(id, checked) => handleToggleValidation(id, checked)}
                              livraisonLabel={livraisonLabel}
                              t={cmd.duree_totale_heures}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                /* Single-level: Direct cards list */
                <div className="cards-grid">
                  {orders.map((cmd) => {
                    // Formater la date de livraison (UTC vers Europe/Paris)
                    const livraisonLabel = cmd.dateLivraison
                      ? new Date(cmd.dateLivraison).toLocaleDateString('fr-FR', {
                          timeZone: 'Europe/Paris',
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })
                      : null;

                    // Get machine color for this order
                    const machineColor = getMachineColor(machineKey);

                    return (
                      <CommandeCard
                        key={cmd.id}
                        commande={cmd}
                        machineColor={machineColor}
                        onStatusChange={(id, statut) => safeChangeStatut(id, statut)}
                        onEdit={(commande) => openFormForEdit(commande)}
                        onDelete={handleDelete}
                        onDeballeChange={(id, checked) => handleToggleDeballe(id, checked)}
                        onValidationChange={(id, checked) => handleToggleValidation(id, checked)}
                        livraisonLabel={livraisonLabel}
                        t={cmd.duree_totale_heures}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {/* État vide quand la recherche ne retourne rien */}
        {orderedMachineKeys.length === 0 && debouncedQuery && !showArchive && (
          <div className="muted" style={{ marginTop: 8 }}>
            Aucune commande ne correspond à « {debouncedQuery} ».
          </div>
        )}

        {/* Archive section for finished orders */}
        {(() => {
          const allFinishedOrders = (commandes || []).filter(c =>
            c.statut === "Terminée"
          );
          const filteredFinishedOrders = (commandes || []).filter(c =>
            c.statut === "Terminée" && matchesQuery(c, debouncedQuery)
          );

          if (allFinishedOrders.length === 0) return null;

          return (
            <div className="archive-section">
              <button
                type="button"
                className={`archive-toggle ${showArchive ? 'active' : ''}`}
                onClick={() => setShowArchive(!showArchive)}
              >
                {showArchive ? 'Masquer l\'archive' : `Voir l'archive (${allFinishedOrders.length})`}
              </button>

              {showArchive && filteredFinishedOrders.length > 0 && (
                <div className="archive-grid">
                  {filteredFinishedOrders.map(cmd => {
                    const livraisonLabel = cmd.dateLivraison
                      ? new Date(cmd.dateLivraison).toLocaleDateString('fr-FR', {
                          timeZone: 'Europe/Paris',
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })
                      : null;

                    return (
                      <div
                        key={`archive-${cmd.id}`}
                        className="carte-commande carte-commande--mini"
                        style={{
                          position: "relative",
                          border: "1px solid #ddd",
                          borderRadius: 6,
                          padding: 8,
                          marginBottom: 4,
                          backgroundColor: "#f8f9fa",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          zIndex: 10
                        }}
                      >
                        <div
                          className="carte-commande__header"
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}
                        >
                          <h3 style={{ margin: 0, fontSize: 14 }}>
                            Commande #{cmd?.numero ?? cmd?.id}
                          </h3>
                          <span style={{
                            backgroundColor: "#28a745",
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: "bold"
                          }}>
                            Terminée
                          </span>
                        </div>

                        <p style={{ fontSize: 12, marginBottom: 4 }}>
                          <strong>Client :</strong> {cmd.client}
                        </p>

                        <p style={{ fontSize: 12, marginBottom: 4 }}>
                          <strong>Date de livraison  :</strong> {livraisonLabel || "—"}
                        </p>

                        <p style={{ fontSize: 12, marginBottom: 6 }}>
                          <strong>Terminée le :</strong>{" "}
                          {cmd.finished_at
                            ? new Date(cmd.finished_at).toLocaleDateString('fr-FR', {
                                timeZone: 'Europe/Paris',
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              })
                            : "—"}
                        </p>

                        <div
                          className="carte-commande__footer"
                          style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}
                        >
                          <button
                            type="button"
                            onClick={() => handleDelete(cmd.id)}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#dc3545",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontSize: 11,
                              pointerEvents: 'auto'
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {showArchive && filteredFinishedOrders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                  Aucune commande terminée ne correspond à votre recherche.
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
