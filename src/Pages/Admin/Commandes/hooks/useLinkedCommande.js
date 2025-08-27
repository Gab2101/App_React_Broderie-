// src/Pages/Admin/Commandes/hooks/useLinkedCommande.js
import { useState } from "react";
import { getLinkedLastFinishAndMachineId, getMachineByName } from "../utils/linked";

export default function useLinkedCommande({ planning, commandes, machines }) {
  const [isLinked, setIsLinked] = useState(false);
  const [linkedCommandeId, setLinkedCommandeId] = useState(null);
  const [sameMachineAsLinked, setSameMachineAsLinked] = useState(false);
  const [startAfterLinked, setStartAfterLinked] = useState(true);

  return {
    isLinked,
    setIsLinked,
    linkedCommandeId,
    setLinkedCommandeId,
    sameMachineAsLinked,
    setSameMachineAsLinked,
    startAfterLinked,
    setStartAfterLinked,
    // helpers (si besoin ailleurs)
    getLinkedLastFinishAndMachineId: (cmdId) => getLinkedLastFinishAndMachineId(planning, cmdId),
    getMachineByName: (name) => getMachineByName(machines, name),
    planning,
    commandes,
    machines,
  };
}
