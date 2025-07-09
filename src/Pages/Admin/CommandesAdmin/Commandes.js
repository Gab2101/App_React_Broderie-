import React, { useState, useEffect, useContext } from "react";
import "../../../styles/Commandes.css";
import { EtiquettesContext } from "../../../context/EtiquettesContext";
import NewButton from "../../../components/common/Newbutton";

function Commandes() {
  const [showModal, setShowModal] = useState(false);
  const [commandes, setCommandes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [saved, setSaved] = useState(false);

  const { articleTags, broderieTags } = useContext(EtiquettesContext);

  const emptyForm = {
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

    if (parseInt(formData.quantite) <= 0 || parseInt(formData.points) <= 0) {
      alert("La quantité et le nombre de points doivent être supérieurs à zéro.");
      return;
    }

    // Machines compatibles
    const compatibles = machines.filter((m) =>
      formData.types.every((tag) => m.etiquettes.includes(tag))
    );

    if (compatibles.length === 0) {
      alert("Aucune machine compatible.");
      return;
    }

    // Calcul scénarios
    const scenarios = [];

    for (const m of compatibles) {
      const planifies = planning
        .filter((p) => p.machineId === m.id)
        .sort((a, b) => new Date(a.debut) - new Date(b.debut));

      let dispo = new Date();
      dispo.setHours(8, 0, 0, 0);
      let preempt = null;

      if (planifies.length > 0) {
        const first = planifies[0];
        const debutFirst = new Date(first.debut);
        const finFirst = new Date(first.fin);
        const commandeExistante = commandes.find((c) => c.id === first.commandeId);

        if (debutFirst > new Date() && commandeExistante && formData.urgence > commandeExistante.urgence) {
          // Préemption possible
          dispo = new Date();
          dispo.setHours(8, 0, 0, 0);
          preempt = { planning: first, commande: commandeExistante };
        } else {
          // Pas de préemption
          dispo = finFirst;
        }
      }

      const pointsTotaux = parseInt(formData.points) * parseInt(formData.quantite);
      const vitesseEffective = m.vitesseMoyenne * parseInt(m.nbTetes);
      const dureeHeures = Math.ceil(pointsTotaux / vitesseEffective);

      scenarios.push({
        machine: m,
        dispo,
        dureeHeures,
        fin: new Date(dispo.getTime() + dureeHeures * 60 * 60 * 1000),
        preempt,
      });
    }

    scenarios.sort((a, b) => a.fin - b.fin);

    const choisi = scenarios[0];

    // Création de la commande
    const nouvelleCommande = {
      ...formData,
      machineAssignee: choisi.machine.nom,
      dureeEstimee: choisi.dureeHeures,
    };

    const resCmd = await fetch("http://localhost:3001/commandes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nouvelleCommande),
    });

    const createdCmd = await resCmd.json();

    // Création du planning
    const planningEntry = {
      machineId: choisi.machine.id,
      commandeId: createdCmd.id,
      debut: choisi.dispo.toISOString(),
      fin: choisi.fin.toISOString(),
    };

    await fetch("http://localhost:3001/planning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(planningEntry),
    });

    // Si préemption, replanifier l'ancienne commande après
    if (choisi.preempt) {
      const ancien = choisi.preempt;
      const dureeAncienne =
        new Date(ancien.planning.fin).getTime() -
        new Date(ancien.planning.debut).getTime();

      const newDebut = new Date(choisi.fin);
      const newFin = new Date(newDebut.getTime() + dureeAncienne);

      await fetch(`http://localhost:3001/planning/${ancien.planning.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ancien.planning,
          debut: newDebut.toISOString(),
          fin: newFin.toISOString(),
        }),
      });
    }

    reloadData();
    resetForm();
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = (id) => {
    if (window.confirm("Supprimer cette commande ?")) {
      const planningsToDelete = planning.filter((p) => p.commandeId === id);

      Promise.all(
        planningsToDelete.map((p) =>
          fetch(`http://localhost:3001/planning/${p.id}`, { method: "DELETE" })
        )
      )
        .then(() =>
          fetch(`http://localhost:3001/commandes/${id}`, { method: "DELETE" })
        )
        .then(() => reloadData())
        .catch((err) => console.error("Erreur suppression:", err));
    }
  };

  const handleNewCommande = () => {
    resetForm();
    setShowModal(true);
  };

  return (
    <div className="commandes-page">
      <NewButton onClick={handleNewCommande}>Nouvelle commande</NewButton>

      {/* Formulaire */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Nouvelle commande</h2>
            <form className="formulaire-commande" onSubmit={handleSubmit}>
              {/* Formulaire identique */}
              <label>Numéro de commande :
                <input
                  type="text"
                  name="numero"
                  value={formData.numero}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>Client :
                <input
                  type="text"
                  name="client"
                  value={formData.client}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>Quantité :
                <input
                  type="number"
                  name="quantite"
                  value={formData.quantite}
                  onChange={handleChange}
                  min="1"
                  required
                />
              </label>
              <label>Points :
                <input
                  type="number"
                  name="points"
                  value={formData.points}
                  onChange={handleChange}
                  min="1"
                  required
                />
              </label>
              <label>Date livraison :
                <input
                  type="date"
                  name="dateLivraison"
                  value={formData.dateLivraison}
                  onChange={handleDateChange}
                />
              </label>
              <label>Urgence :
                <select
                  name="urgence"
                  value={formData.urgence}
                  onChange={handleChange}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              <label>Types :</label>
              <div className="tags-container">
                {articleTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag ${formData.types.includes(tag) ? "active" : ""}`}
                    onClick={() => toggleTag("types", tag)}>
                    {tag}
                  </button>
                ))}
              </div>

              <label>Options :</label>
              <div className="tags-container">
                {broderieTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag ${formData.options.includes(tag) ? "active" : ""}`}
                    onClick={() => toggleTag("options", tag)}>
                    {tag}
                  </button>
                ))}
              </div>

              <button type="submit" className="btn-enregistrer">Enregistrer</button>
            </form>
            {saved && <div className="message-saved">✅ Enregistré</div>}
            <button className="btn-fermer" onClick={() => setShowModal(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Liste commandes */}
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
