import React, { useState, useEffect } from "react";
import "../../../styles/Commandes.css";
import NewButton from "../../../components/common/Newbutton";

function Commandes() {
  const [showModal, setShowModal] = useState(false);
  const [commandes, setCommandes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [saved, setSaved] = useState(false);

  const [selectedScenario, setSelectedScenario] = useState(null);
  const [selectedMachineId, setSelectedMachineId] = useState(null);

  const emptyForm = {
    id: null,
    numero: "",
    client: "",
    quantite: "",
    points: "",
    urgence: 3,
    dateLivraison: "",
    types: [],
    options: [],
  };

  const [formData, setFormData] = useState(emptyForm);

  const reloadData = () => {
    Promise.all([
      fetch("http://localhost:3001/commandes").then((res) => res.json()),
      fetch("http://localhost:3001/machines").then((res) => res.json()),
      fetch("http://localhost:3001/planning").then((res) => res.json()),
    ])
      .then(([c, m, p]) => {
        setCommandes(c);
        setMachines(m);
        setPlanning(p);
      })
      .catch((err) => console.error("Erreur chargement données:", err));
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (parseInt(formData.quantite) <= 0 || parseInt(formData.points) <= 0) {
      alert("La quantité et le nombre de points doivent être supérieurs à zéro.");
      return;
    }

    if (formData.id) {
      const res = await fetch(`http://localhost:3001/commandes/${formData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        alert("Erreur lors de la mise à jour.");
        return;
      }

      reloadData();
      resetForm();
      return;
    }

    const compatibles = machines.filter((m) =>
      formData.types.every((tag) => (m.etiquettes || []).includes(tag))
    );

    if (compatibles.length === 0) {
      alert("Aucune machine compatible.");
      return;
    }

    const scenarios = [];

    for (const m of compatibles) {
      const planifies = planning
        .filter((p) => p.machineId === m.id)
        .sort((a, b) => new Date(a.debut) - new Date(b.debut));

      let dispo = new Date();
      dispo.setHours(8, 0, 0, 0);

      if (planifies.length > 0) {
        const lastFin = new Date(planifies[planifies.length - 1].fin);
        dispo = lastFin;
      }

      const pointsTotaux = parseInt(formData.points) * parseInt(formData.quantite);
      const vitesseEffective = m.vitesseMoyenne * parseInt(m.nbTetes);
      const dureeHeures = Math.ceil(pointsTotaux / vitesseEffective);

      scenarios.push({
        machine: m,
        dispo,
        dureeHeures,
        fin: new Date(dispo.getTime() + dureeHeures * 60 * 60 * 1000),
      });
    }

    scenarios.sort((a, b) => a.fin - b.fin);
    const choisi = scenarios[0];

    setSelectedScenario(choisi);
    setSelectedMachineId(choisi.machine.id);
  };

  const confirmCreation = async () => {
    const machine = machines.find((m) => m.id === selectedMachineId);
    if (!machine) {
      alert("Machine invalide.");
      return;
    }

    if (!formData.types.every((tag) => (machine.etiquettes || []).includes(tag))) {
      alert("Machine incompatible.");
      return;
    }

    const planifies = planning
      .filter((p) => p.machineId === machine.id)
      .sort((a, b) => new Date(a.debut) - new Date(b.debut));

    let dispo = new Date();
    dispo.setHours(8, 0, 0, 0);

    if (planifies.length > 0) {
      const lastFin = new Date(planifies[planifies.length - 1].fin);
      dispo = lastFin;
    }

    const pointsTotaux = parseInt(formData.points) * parseInt(formData.quantite);
    const vitesseEffective = machine.vitesseMoyenne * parseInt(machine.nbTetes);
    const dureeHeures = Math.ceil(pointsTotaux / vitesseEffective);

    const debut = dispo;
    const fin = new Date(debut.getTime() + dureeHeures * 60 * 60 * 1000);

    // IMPORTANT : retirer l'id avant POST
    const { id, ...formSansId } = formData;

    const nouvelleCommande = {
      ...formSansId,
      machineAssignee: machine.nom,
      dureeEstimee: dureeHeures,
    };

    const resCmd = await fetch("http://localhost:3001/commandes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nouvelleCommande),
    });

    const createdCmd = await resCmd.json();

    const planningEntry = {
      machineId: machine.id,
      commandeId: createdCmd.id,
      debut: debut.toISOString(),
      fin: fin.toISOString(),
    };

    await fetch("http://localhost:3001/planning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planningEntry),
    });

    setSelectedScenario(null);
    setSelectedMachineId(null);
    setShowModal(false);
    reloadData();
    resetForm();
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette commande ?")) {
      return;
    }

    try {
      const planningsToDelete = planning.filter((p) => p.commandeId === id);

      for (const p of planningsToDelete) {
        await fetch(`http://localhost:3001/planning/${p.id}`, {
          method: "DELETE",
        });
      }

      const resCmd = await fetch(`http://localhost:3001/commandes/${id}`, {
        method: "DELETE",
      });

      if (!resCmd.ok) {
        alert(`Erreur lors de la suppression de la commande.`);
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
  };

  return (
    <div className="commandes-page">
      <NewButton onClick={handleNewCommande}>Nouvelle commande</NewButton>

      {showModal && !selectedScenario && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{formData.id ? "Modifier la commande" : "Nouvelle commande"}</h2>
            <form className="formulaire-commande" onSubmit={handleSubmit}>
              <label>Numéro de commande :
                <input
                  type="text"
                  name="numero"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  required
                />
              </label>
              <label>Client :
                <input
                  type="text"
                  name="client"
                  value={formData.client}
                  onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                  required
                />
              </label>
              <label>Quantité :
                <input
                  type="number"
                  name="quantite"
                  value={formData.quantite}
                  onChange={(e) => setFormData({ ...formData, quantite: e.target.value })}
                  min="1"
                  required
                />
              </label>
              <label>Points :
                <input
                  type="number"
                  name="points"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                  min="1"
                  required
                />
              </label>
              <label>Date livraison :
                <input
                  type="date"
                  name="dateLivraison"
                  value={formData.dateLivraison}
                  onChange={(e) => setFormData({ ...formData, dateLivraison: e.target.value })}
                />
              </label>
              <label>Urgence :
                <select
                  name="urgence"
                  value={formData.urgence}
                  onChange={(e) => setFormData({ ...formData, urgence: e.target.value })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              <button type="submit" className="btn-enregistrer">Enregistrer</button>
            </form>
            {saved && <div className="message-saved">✅ Enregistré</div>}
            <button className="btn-fermer" onClick={() => setShowModal(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {selectedScenario && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirmer la machine</h2>
            <p><strong>Machine proposée :</strong> {selectedScenario.machine.nom}</p>
            <p><strong>Durée estimée :</strong> {selectedScenario.dureeHeures} heures</p>
            <label>Choisir une autre machine :</label>
            <select
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
            >
              {machines
                .filter((m) =>
                  formData.types.every((t) => (m.etiquettes || []).includes(t))
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>{m.nom}</option>
                ))}
            </select>
            <button onClick={confirmCreation} style={{ marginTop: "10px" }}>
              Confirmer ce choix
            </button>
          </div>
        </div>
      )}

      <div className="liste-commandes">
        {commandes.map((cmd) => (
          <div key={cmd.id} className="carte-commande">
            <h3>Commande #{cmd.numero}</h3>
            <p><strong>Client :</strong> {cmd.client}</p>
            <p><strong>Quantité :</strong> {cmd.quantite}</p>
            <p><strong>Points :</strong> {cmd.points}</p>
            <p><strong>Urgence :</strong> {cmd.urgence}</p>
            <p><strong>Livraison :</strong> {cmd.dateLivraison}</p>
            {cmd.machineAssignee && <p><strong>Machine :</strong> {cmd.machineAssignee}</p>}
            {cmd.dureeEstimee && <p><strong>Durée estimée :</strong> {cmd.dureeEstimee} h</p>}
            <button
              onClick={() => {
                setFormData({
                  ...cmd,
                  id: cmd.id,
                  quantite: String(cmd.quantite),
                  points: String(cmd.points),
                  urgence: String(cmd.urgence),
                });
                setSaved(false);
                setShowModal(true);
              }}
              className="btn-enregistrer">
              Modifier
            </button>
            <button
              onClick={() => handleDelete(cmd.id)}
              className="btn-fermer">
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Commandes;
