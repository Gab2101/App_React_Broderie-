// src/Pages/Admin/Commandes/hooks/useLinkedCommande.js
import { useState } from "react";
import {
  getLinkedLastFinishAndMachineId,
  getMachineByName,
} from "../utils/linked";

export default function useLinkedCommande({ planning, commandes, machines }) {
  const [isLinked, setIsLinked] = useState(false);
  const [linkedCommandeId, _setLinkedCommandeId] = useState(null);
  const [sameMachineAsLinked, setSameMachineAsLinked] = useState(false);
  const [startAfterLinked, setStartAfterLinked] = useState(true);

  // -- Helpers internes sûrs --
  const toId = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const setLinkedCommandeId = (v) => _setLinkedCommandeId(toId(v));

  const clearLink = () => {
    setIsLinked(false);
    _setLinkedCommandeId(null);
    setSameMachineAsLinked(false);
    setStartAfterLinked(true);
  };

  // Renvoie { lastFinish, machineId } pour l'ID fourni (ou nulls)
  const getLinkedLastFinishAndMachineIdSafe = (cmdId) =>
    getLinkedLastFinishAndMachineId(planning, toId(cmdId));

  // Tente de déduire l'ID machine attendu à partir de la commande liée :
  // 1) machineId du dernier créneau de la commande liée (planning)
  // 2) sinon, machineAssignee (nom) stocké sur la commande, converti en ID
  const getExpectedMachineIdFromLinked = (cmdId) => {
    const idNum = toId(cmdId);
    if (!idNum) return null;

    const { machineId } = getLinkedLastFinishAndMachineId(planning, idNum) || {};
    if (machineId) return machineId;

    const linkedCmd = (commandes || []).find((c) => Number(c.id) === idNum);
    const byName =
      linkedCmd?.machineAssignee
        ? getMachineByName(machines, linkedCmd.machineAssignee)
        : null;

    return byName?.id ?? null;
  };

  return {
    // state
    isLinked,
    setIsLinked,
    linkedCommandeId,
    setLinkedCommandeId,
    sameMachineAsLinked,
    setSameMachineAsLinked,
    startAfterLinked,
    setStartAfterLinked,

    // helpers exposés
    clearLink,
    getLinkedLastFinishAndMachineId: getLinkedLastFinishAndMachineIdSafe,
    getExpectedMachineIdFromLinked,
    getMachineByName: (name) => getMachineByName(machines, name),

    // données brutes si besoin
    planning,
    commandes,
    machines,
  };
}
