// src/Pages/Admin/Commandes/CommandesPage.jsx
import React, { useContext, useState } from "react";
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

  // Chargement & realtime
  const {
    commandes,
    setCommandes,
    machines,
    planning,
    nettoyageRules,
    linkableCommandes,
    reloadData,
  } = useCommandesData();

  // Formulaire
  const form = useForm();

  // Liaison
  const linked = useLinkedCommande({ planning, commandes, machines });

  // Simulation (scénarios, % temps réel, machine, monoUnitsUsed, etc.)
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

  // Statut
  const { STATUTS, handleChangeStatut } = useStatut({ commandes, setCommandes });

  // Ouverture/fermeture des modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const openFormForNew = () => {
    form.resetForm();
    linked.setIsLinked(false);
    linked.setLinkedCommandeId(null);
    linked.setSameMachineAsLinked(false);
    linked.setStartAfterLinked(true);
    sim.setSelectedScenario(null);
    sim.setMachineAssignee(null);
    sim.setConfirmCoef(350);
    sim.setMonoUnitsUsed(1);
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
    sim.setMonoUnitsUsed(Number(cmd.mono_units_used || 1)); // si déjà enregistré
    setIsFormOpen(true);
  };

  // Soumission du formulaire (création → simulation ; édition → update)
  const handleSubmitForm = async () => {
    if (parseInt(form.formData.quantite, 10) <= 0 || parseInt(form.formData.points, 10) <= 0) {
      alert("La quantité et le nombre de points doivent être supérieurs à zéro.");
      return;
    }
    if (form.formData.id) {
      const { error } = await apiUpdateCommande(form.formData);
      if (error) {
        alert("Erreur lors de la mise à jour.");
        console.error(error);
        return;
      }
      await reloadData();
      form.resetForm();
      setIsFormOpen(false);
      return;
    }
    // Création → simuler
    await sim.handleSimulation();
    if (sim.selectedScenario) {
      setIsFormOpen(false);
      setIsConfirmOpen(true);
    }
  };

  // Confirmation de création : appelle le service
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
      monoUnitsUsed, // 👈 nouveau
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

  // Suppression
  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette commande ?")) return;
    const { error } = await deleteCommandeWithPlanning(id);
    if (error) {
      alert("Erreur lors de la suppression de la commande.");
      console.error(error);
      return;
    }
    await reloadData();
  };

  return (
    <div className="commandes-page">
      <NewButton onClick={openFormForNew}>Nouvelle commande</NewButton>

      {/* Modale création / édition */}
      <CommandeFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmitForm}
        // form
        formData={form.formData}
        handleChange={form.handleChange}
        handleDateChange={form.handleDateChange}
        toggleTag={form.toggleTag}
        saved={form.saved}
        // liaison
        isLinked={linked.isLinked}
        setIsLinked={linked.setIsLinked}
        linkedCommandeId={linked.linkedCommandeId}
        setLinkedCommandeId={linked.setLinkedCommandeId}
        sameMachineAsLinked={linked.sameMachineAsLinked}
        setSameMachineAsLinked={linked.setSameMachineAsLinked}
        startAfterLinked={linked.startAfterLinked}
        setStartAfterLinked={linked.setStartAfterLinked}
        linkableCommandes={linkableCommandes}
        // tags
        articleTags={articleTags}
        broderieTags={broderieTags}
        // édition ?
        isEditing={Boolean(form.formData?.id)}
      />

      {/* Modale confirmation machine + % temps réel + mono units */}
      <MachineAndTimeConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
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
        onConfirm={({ machineId, coef, monoUnitsUsed }) => handleConfirmCreation({ machineId, coef, monoUnitsUsed })}
      />

      {/* Liste commandes */}
      <div className="liste-commandes">
        {commandes.map((cmd) => (
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
      </div>
    </div>
  );
}
