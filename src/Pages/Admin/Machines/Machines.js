import React, { useState, useEffect, useContext } from 'react';
import './Machines.css';
import '../../../styles/Common.css';
import { EtiquettesContext } from '../../../context/EtiquettesContext';
import NewButton from '../../../components/common/Newbutton';

function Machines() {
  const { articleTags, broderieTags } = useContext(EtiquettesContext);

  const [showModalForm, setShowModalForm] = useState(false);
  const [machineDetails, setMachineDetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [machines, setMachines] = useState([]);
  const [formData, setFormData] = useState({
    nom: '',
    nbTetes: '',
    etiquettes: []
  });

  useEffect(() => {
    fetch("http://localhost:3001/machines")
      .then(res => res.json())
      .then(data => setMachines(data))
      .catch(err => console.error("Erreur chargement machines :", err));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleTag = (tag) => {
    setFormData(prev => {
      const current = [...prev.etiquettes];
      const index = current.indexOf(tag);
      if (index > -1) {
        current.splice(index, 1);
      } else {
        current.push(tag);
      }
      return { ...prev, etiquettes: current };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    fetch("http://localhost:3001/machines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    })
      .then(res => res.json())
      .then((data) => {
        setMachines(prev => [...prev, data]);
        setFormData({ nom: '', nbTetes: '', etiquettes: [] });
        setShowModalForm(false);
      })
      .catch(err => console.error("Erreur ajout machine :", err));
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    fetch(`http://localhost:3001/machines/${machineDetails.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    })
      .then(res => res.json())
      .then((data) => {
        const updated = machines.map((m) => (m.id === data.id ? data : m));
        setMachines(updated);
        setMachineDetails(null);
        setIsEditing(false);
      })
      .catch(err => console.error("Erreur modification machine :", err));
  };

  const handleDelete = (id) => {
    if (window.confirm("Confirmer la suppression ?")) {
      fetch(`http://localhost:3001/machines/${id}`, {
        method: "DELETE"
      })
        .then(() => {
          setMachines(prev => prev.filter((m) => m.id !== id));
          setMachineDetails(null);
        })
        .catch(err => console.error("Erreur suppression machine :", err));
    }
  };

  return (
    <div className="machines-page">
      <NewButton onClick={() => {
        setFormData({ nom: '', nbTetes: '', etiquettes: [] });
        setShowModalForm(true);
        setMachineDetails(null);
        setIsEditing(false);
      }}>
        Nouvelle machine
      </NewButton>

      {/* Modale création */}
      {showModalForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Nouvelle machine</h2>
            <form onSubmit={handleSubmit} className="formulaire-machine">
              <label>
                Nom :
                <input
                  type="text"
                  name="nom"
                  value={formData.nom}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Nombre de têtes :
                <select
                  name="nbTetes"
                  value={formData.nbTetes}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Sélectionner --</option>
                  {[1,2,4,6,8,12,15,18,20].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label>Étiquettes :</label>
              <div className="tags-container">
                {[...articleTags, ...broderieTags].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag ${formData.etiquettes.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <button type="submit" className="btn-enregistrer">Enregistrer</button>
              <button
                type="button"
                className="btn-fermer"
                onClick={() => setShowModalForm(false)}
              >
                Annuler
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Liste des machines */}
      <div className="liste-machines">
        {machines.map(machine => (
          <div
            key={machine.id}
            className="carte-machine"
            onClick={() => {
              setMachineDetails(machine);
              setFormData(machine);
              setIsEditing(false);
            }}
          >
            <h3>{machine.nom}</h3>
            <p><strong>Têtes :</strong> {machine.nbTetes}</p>
            {machine.etiquettes?.length > 0 && (
              <div className="tag-list">
                {machine.etiquettes.map((t, i) => (
                  <span key={i} className="tag readonly">{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modale consultation / édition */}
      {machineDetails && (
        <div className="modal-overlay">
          <div className="modal">
            {!isEditing ? (
              <>
                <h2>{machineDetails.nom}</h2>
                <p><strong>Nombre de têtes :</strong> {machineDetails.nbTetes}</p>
                {machineDetails.etiquettes?.length > 0 && (
                  <>
                    <p><strong>Étiquettes :</strong></p>
                    <div className="tag-list">
                      {machineDetails.etiquettes.map((t, i) => (
                        <span key={i} className="tag readonly">{t}</span>
                      ))}
                    </div>
                  </>
                )}
                <div className="btn-zone">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="btn-enregistrer"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(machineDetails.id)}
                    className="btn-fermer"
                  >
                    Supprimer
                  </button>
                  <button
                    onClick={() => setMachineDetails(null)}
                    className="btn-fermer"
                  >
                    Fermer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Modifier {machineDetails.nom}</h2>
                <form onSubmit={handleEditSubmit} className="formulaire-machine">
                  <label>
                    Nom :
                    <input
                      type="text"
                      name="nom"
                      value={formData.nom}
                      onChange={handleChange}
                      required
                    />
                  </label>
                  <label>
                    Nombre de têtes :
                    <select
                      name="nbTetes"
                      value={formData.nbTetes}
                      onChange={handleChange}
                      required
                    >
                      <option value="">-- Sélectionner --</option>
                      {[1,2,4,6,8,12,15,18,20].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label>Étiquettes :</label>
                  <div className="tags-container">
                    {[...articleTags, ...broderieTags].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className={`tag ${formData.etiquettes.includes(tag) ? 'active' : ''}`}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <div className="btn-zone">
                    <button type="submit" className="btn-enregistrer">Enregistrer</button>
                    <button
                      type="button"
                      className="btn-fermer"
                      onClick={() => setIsEditing(false)}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Machines;
