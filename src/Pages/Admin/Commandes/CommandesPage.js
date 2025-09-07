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

import { parseLocalDatetime, toUTCISOString, snapToNextWorkStart, addMinutesWithinWorkHours, DEFAULT_WORKDAY } from "./utils/workhours";

import {
  createCommandeAndPlanning,
  updateCommande as apiUpdateCommande,
  deleteCommandeWithPlanning,
} from "./services/commandesApi";
import { createCommandeWithAssignations } from "./services/assignationsApi";

export default function CommandesPage() {
  const { articleTags, broderieTags } = useContext(EtiquettesContext);

  const {
    commandes,
    setCommandes,
    machines,
    planning,
    nettoyageRules,
    linkableCommandes,
    reloadData,
  } = useCommandesData();

  const form = useForm();
  const linked = useLinkedCommande({ planning, commandes, machines });

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

  const { STATUTS, handleChangeStatut } = useStatut({ commandes, setCommandes });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);     // mono
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verrou de flux : "idle" | "mono" | "multi"
  const [creationFlow, setCreationFlow] = useState("idle");

  // Modal de confirmation MULTI
  const [isMultiConfirmOpen, setIsMultiConfirmOpen] = useState(false);
  const [pendingMultiPayload, setPendingMultiPayload] = useState(null);

  const resetCreationState = () => {
    form.resetForm();
    linked.setIsLinked(false);
    linked.setLinkedCommandeId(null);
    linked.setSameMachineAsLinked(false);
    linked.setStartAfterLinked(true);
    sim.setSelectedScenario(null);
    sim.setMachineAssignee(null);
    sim.setConfirmCoef(350);
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
    sim.setConfirmCoef(350);
    sim.setMonoUnitsUsed(Number(cmd.mono_units_used || 1));
    setIsFormOpen(true);
  };

  /**
   * handleSubmitForm
   * On n'accepte que deux valeurs explicites :
   *  - { flow: "multi", ... }
   *  - { flow: "mono" }
   * Tout autre appel est ignoré (empêche les ouvertures fantômes).
   */
  const handleSubmitForm = async (config) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const qty = parseInt(form.formData.quantite, 10);
      const pts = parseInt(form.formData.points, 10);
      if (qty <= 0 || pts <= 0) {
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

      // --- MULTI (prioritaire & exclusif) ---
      if (config?.flow === "multi") {
        const list = Array.isArray(config.perMachine) ? config.perMachine : [];
        const validList = list.filter(r => r && r.machineId && Number(r.quantity) > 0);

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
            form.formData?.date_debut_planning ||
            new Date().toISOString(),
        });

        setIsFormOpen(false);
        setIsConfirmOpen(false);      // jamais de modale mono dans ce flux
        setIsMultiConfirmOpen(true);
        return;                       // pas d'insert ici
      }

      // --- MONO (explicit only) ---
      if (config?.flow === "mono") {
        // si on venait d'un multi, on bloque
        if (creationFlow === "multi") return;

        await sim.handleSimulation();
        if (sim.selectedScenario) {
          setCreationFlow("mono");
          setIsFormOpen(false);
          setIsConfirmOpen(true);
        }
        return;
      }

      // Tout autre appel est ignoré (sécurité)
      console.warn("[handleSubmitForm] Appel ignoré : payload inattendu", config);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enregistrement final MULTI (depuis la modale de confirmation MULTI)
  const handleConfirmMultiSave = async ({ perMachine, meta, plannedStartLocal, respectWorkHours }) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // 1) base locale choisie dans le modal
      let baseLocal = parseLocalDatetime(plannedStartLocal);

      // 2) si on respecte les heures ouvrées, on "snap" à la prochaine fenêtre ouvrée (08:00)
      if (respectWorkHours) {
        baseLocal = snapToNextWorkStart(baseLocal, DEFAULT_WORKDAY);
      }

      // 3) pour CHAQUE assignation, même début, fin calculée
      const enriched = perMachine.map((r) => {
        const dur = Number(r.durationCalcMinutes || r.durationTheoreticalMinutes || 0);
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

  // Confirmation création (flux mono)
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
      alert("Erreur lors de la création de la commande.\n" + (errorCmd.message || "Regarde la console."));
      return;
    }
    if (errorPlanning) {
      console.error("Erreur création planning:", errorPlanning);
      alert("La commande a été créée, mais l'insertion dans le planning a échoué.\n" + (errorPlanning.message || ""));
    }

    sim.setSelectedScenario(null);
    sim.setMachineAssignee(null);
    sim.setConfirmCoef(350);
    sim.setMonoUnitsUsed(1);
    setIsConfirmOpen(false);
    setCreationFlow("idle");

    await reloadData();
    form.resetForm();
  };

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

  // 🚦 Garde-fou : empêcher 2 "En cours" sur la même machine
  const safeChangeStatut = (id, nextStatut) => {
    try {
      const current = commandes.find((c) => String(c.id) === String(id));
      if (!current) return;

      // On ne bloque que si on veut passer en "En cours"
      if (nextStatut === "En cours") {
        const machine =
          current.machineAssignee ||
          current.machine ||
          current.machine_id ||
          null;

        if (!machine) {
          alert("Impossible de passer en « En cours » : assignez d'abord une machine à la commande.");
          return;
        }

        const conflict = commandes.find(
          (c) =>
            String(c.id) !== String(id) &&
            (c.machineAssignee === machine || c.machine === machine || c.machine_id === machine) &&
            c.statut === "En cours"
        );

        if (conflict) {
          const label = conflict.numero ? `#${conflict.numero}` : String(conflict.id);
          alert(
            `Conflit : la machine « ${machine} » a déjà une commande en cours (${label}).\n` +
            `Terminez-la d'abord avant d'en lancer une autre.`
          );
          return; // ❌ on bloque le changement
        }
      }

      // ✅ pas de conflit → on autorise
      handleChangeStatut(id, nextStatut);
    } catch (e) {
      console.error("safeChangeStatut error", e);
    }
  };

  return (
    <div className="commandes-page">
      <NewButton onClick={openFormForNew} disabled={isSubmitting}>
        Nouvelle commande
      </NewButton>

      {/* 1) Formulaire création/édition */}
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
        articleTags={articleTags}      // ✅ indispensable
        broderieTags={broderieTags}    // ✅ indispensable
        machines={machines}
        isEditing={Boolean(form.formData?.id)}
      />

      {/* 2) Confirmation mono — jamais si un flux multi est actif */}
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

      {/* 3) Confirmation MULTI */}
      <MultiMachineConfirmModal
        isOpen={isMultiConfirmOpen && creationFlow === "multi"}
        onClose={() => !isSubmitting && setIsMultiConfirmOpen(false)}
        onSubmit={handleSubmitForm}
        payload={pendingMultiPayload}
        machines={machines}
        onConfirm={handleConfirmMultiSave}
      />

      {/* Liste commandes */}
      <div className="liste-commandes">
        {commandes.map((cmd) => (
          <CommandeCard
            key={cmd.id}
            cmd={cmd}
            STATUTS={STATUTS}
            onChangeStatut={(id, statut) => safeChangeStatut(id, statut)}   // use safeChangeStatut
            onEdit={openFormForEdit}
            onDelete={handleDelete}
            machines={machines}
            articleTags={articleTags}
            nettoyageRules={nettoyageRules}
          />
        ))}
      </div>
    </div>
  );
}
