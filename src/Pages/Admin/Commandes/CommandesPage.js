// src/Pages/Admin/Commandes/CommandesPage.jsx
import React, { useContext, useState, useMemo, useCallback } from "react";
import "../../../styles/Commandes.css";
import NewButton from "../../../components/common/NewButton";
import { EtiquettesContext } from "../../../context/EtiquettesContext";

import CommandeFormModal from "./components/CommandeFormModal";
import MachineAndTimeConfirmModal from "./components/MachineAndTimeConfirmModal";
import CommandeCard from "./components/CommandeCard";

import useCommandesData from "./hooks/useCommandesData";
import useForm from "./hooks/useForm";
import useLinkedCommande from "./hooks/useLinkedCommande";
import useSimulation from "./hooks/useSimulation";
import useStatut from "./hooks/useStatut";

import {
  createCommandeAndPlanning,
  updateCommande as apiUpdateCommande,
  deleteCommandeWithPlanning,
} from "./services/commandesApi";

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
  const [isConfirmOpen, setIsConfirmOpen] = useState(false); // mono uniquement
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Barre de recherche ---
  const [searchQuery, setSearchQuery] = useState("");

  const normalize = useCallback(
    (v) =>
      (v ?? "")
        .toString()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim(),
    []
  );

  const stringifyCommande = useCallback(
    (cmd) => {
      const parts = [
        cmd?.reference,
        cmd?.ref_commande,
        cmd?.ref_client,
        cmd?.client,
        cmd?.nom_client,
        cmd?.description,
        cmd?.libelle,
        cmd?.statut,
        ...(Array.isArray(cmd?.types) ? cmd.types : []),
        ...(Array.isArray(cmd?.options) ? cmd.options : []),
        ...(Array.isArray(cmd?.article_tags) ? cmd.article_tags : []),
        ...(Array.isArray(cmd?.broderie_tags) ? cmd.broderie_tags : []),
        cmd?.machine_name,
        ...(Array.isArray(cmd?.assignations)
          ? cmd.assignations.map((a) => `${a?.machine_name ?? ""} ${a?.quantity ?? ""}`)
          : []),
        String(cmd?.quantite ?? ""),
        String(cmd?.points ?? ""),
        String(cmd?.urgence ?? ""),
        cmd?.date_debut_planning ?? "",
        cmd?.date_fin_planning ?? "",
      ].filter(Boolean);
      return normalize(parts.join(" "));
    },
    [normalize]
  );

  const filteredCommandes = useMemo(() => {
    const q = normalize(searchQuery);
    if (!q) return commandes;
    return (commandes || []).filter((cmd) => stringifyCommande(cmd).includes(q));
  }, [commandes, searchQuery, stringifyCommande, normalize]);

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

  // --- Submit du formulaire (MONO uniquement) ---
  const handleSubmitForm = async () => {
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

      // CRÉATION — on lance la simulation puis on ouvre la modale de confirmation mono
      await sim.handleSimulation();
      if (sim.selectedScenario) {
        setIsFormOpen(false);
        setIsConfirmOpen(true); // <-- bug corrigé
      }
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

  return (
    <div className="commandes-page">
      <NewButton onClick={openFormForNew} disabled={isSubmitting}>
        Nouvelle commande
      </NewButton>

      {/* Barre de recherche */}
      <div className="commandes-search" style={{ margin: "12px 0", display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="Rechercher une commande (client, référence, statut, machine, tags...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            outline: "none",
          }}
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="btn-clear-search"
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f6f6f6",
              cursor: "pointer",
            }}
          >
            Effacer
          </button>
        ) : null}
      </div>

      {/* 1) Formulaire création/édition */}
      <CommandeFormModal
        isOpen={isFormOpen}
        onClose={() => !isSubmitting && setIsFormOpen(false)}
        onSubmit={handleSubmitForm} // toujours mono
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
        nettoyageRules={nettoyageRules}
        machines={machines}
        isEditing={Boolean(form.formData?.id)}
      />

      {/* 2) Confirmation mono */}
      <MachineAndTimeConfirmModal
        isOpen={isConfirmOpen}
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

      {/* Liste commandes (filtrée) */}
      <div className="liste-commandes">
        {filteredCommandes.map((cmd) => (
          <CommandeCard
            key={cmd.id}
            cmd={cmd}
            STATUTS={STATUTS}
            onChangeStatut={(id, statut) => handleChangeStatut(id, statut)}
            onEdit={openFormForEdit}
            onDelete={handleDelete}
            machines={machines}
            articleTags={articleTags}
            nettoyageRules={nettoyageRules}
          />
        ))}
        {filteredCommandes.length === 0 && (
          <div style={{ padding: 16, color: "#666" }}>
            Aucune commande ne correspond à « {searchQuery} ».
          </div>
        )}
      </div>
    </div>
  );
}
