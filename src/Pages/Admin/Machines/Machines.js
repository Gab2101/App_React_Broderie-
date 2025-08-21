import React, { useState, useEffect, useContext } from "react";
import "./Machines.css";
import "../../../styles/Common.css";
import { EtiquettesContext } from "../../../context/EtiquettesContext";
import NewButton from "../../../components/common/NewButton";
import { supabase } from "../../../supabaseClient";
import MachinesCard from "./MachinesCard"; // Assurez-vous que le chemin est correct
import MachinesForm from "./MachinesForm"; // Assurez-vous que le chemin est correct

function Machines() {
  const { articleTags, broderieTags } = useContext(EtiquettesContext);

  const [showModalForm, setShowModalForm] = useState(false);
  const [machineDetails, setMachineDetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [machines, setMachines] = useState([]);
  const [formData, setFormData] = useState({
    nom: "",
    nbTetes: "",
    etiquettes: [],
  });

  // Charger les machines
  useEffect(() => {
  const loadMachines = async () => {
    const { data, error } = await supabase
      .from("machines")
      .select("id, nom, nbTetes, etiquettes");

    if (error) {
      console.error("Erreur chargement machines :", error);
      return;
    }

    // ✅ Corrige ici : transforme en tableau si c'est du texte
    const normalized = data.map((m) => ({
      ...m,
      etiquettes:
        typeof m.etiquettes === "string"
          ? JSON.parse(m.etiquettes)
          : Array.isArray(m.etiquettes)
          ? m.etiquettes
          : [],
    }));

    setMachines(normalized);
  };

  loadMachines();
}, []);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleTag = (label) => {
    setFormData((prev) => {
      const current = [...prev.etiquettes];
      const index = current.indexOf(label);
      if (index > -1) {
        current.splice(index, 1);
      } else {
        current.push(label);
      }
      return { ...prev, etiquettes: current };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase
      .from("machines")
      .insert([
        {
          nom: formData.nom,
          nbTetes: parseInt(formData.nbTetes),
          etiquettes: formData.etiquettes,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Erreur ajout machine :", error);
      return;
    }

    const parsedEtiquettes =
      typeof data.etiquettes === "string"
      ? JSON.parse(data.etiquettes)
      : Array.isArray(data.etiquettes)
      ? data.etiquettes
      : [];

    setMachines((prev) => [...prev, { ...data, etiquettes: parsedEtiquettes }]);

    setFormData({ nom: "", nbTetes: "", etiquettes: [] });
    setShowModalForm(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    const { data, error } = await supabase
      .from("machines")
      .update({
        nom: formData.nom,
        nbTetes: parseInt(formData.nbTetes),
        etiquettes: formData.etiquettes,
      })
      .eq("id", machineDetails.id)
      .select()
      .single();

    if (error) {
      console.error("Erreur modification machine :", error);
      return;
    }

    const updated = machines.map((m) => (m.id === data.id ? { ...data, etiquettes: data.etiquettes || [] } : m));
    setMachines(updated);
    setMachineDetails(null);
    setIsEditing(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Confirmer la suppression ?")) {
      const { error } = await supabase.from("machines").delete().eq("id", id);
      if (error) {
        console.error("Erreur suppression machine :", error);
        return;
      }
      setMachines((prev) => prev.filter((m) => m.id !== id));
      setMachineDetails(null);
    }
  };

  return (
    <div className="machines-page">
      <NewButton
        onClick={() => {
          setFormData({ nom: "", nbTetes: "", etiquettes: [] });
          setShowModalForm(true);
          setMachineDetails(null);
          setIsEditing(false);
        }}
      >
        Nouvelle machine
      </NewButton>

      {/* Modale création */}
      {showModalForm && (
  <div className="modal-overlay">
    <div className="modal">
      <MachinesForm
        formData={formData}
        articleTags={articleTags}
        broderieTags={broderieTags}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={() => setShowModalForm(false)}
        toggleTag={toggleTag}
        isEditing={false}
      />
    </div>
  </div>
)}


      {/* Liste des machines */}
      <div className="liste-machines">
  {machines.map((machine) => (
    <MachinesCard
      key={machine.id}
      machine={machine}
      articleTags={articleTags}
      broderieTags={broderieTags}
      onClick={(m) => {
        setMachineDetails(m);
        setFormData({
          nom: m.nom,
          nbTetes: m.nbTetes,
          etiquettes: Array.isArray(m.etiquettes) ? m.etiquettes : [],
        });
        setIsEditing(false);
      }}
    />
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
          {(machineDetails.etiquettes || []).length > 0 && (
            <>
              <div className="etiquettes-section">
                <p><strong>Articles :</strong></p>
                <div className="tag-list">
                  {machineDetails.etiquettes
                    .filter((t) => articleTags.some((a) => a.label === t))
                    .map((t, i) => (
                      <span key={i} className="tag readonly">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="etiquettes-section">
                  <p><strong>Options de broderie :</strong></p>
                  <div className="tag-list">
                    {machineDetails.etiquettes
                      .filter((t) => broderieTags.some((b) => b.label === t))
                      .map((t, i) => (
                        <span key={i} className="tag readonly">{t}</span>
                      ))}
                  </div>
                </div>
            </>
          )}
          <div className="btn-zone">
            <button onClick={() => setIsEditing(true)} className="btn-enregistrer">Modifier</button>
            <button onClick={() => handleDelete(machineDetails.id)} className="btn-fermer">Supprimer</button>
            <button onClick={() => setMachineDetails(null)} className="btn-fermer">Fermer</button>
          </div>
        </>
      ) : (
        <MachinesForm
          formData={formData}
          articleTags={articleTags}
          broderieTags={broderieTags}
          onChange={handleChange}
          onSubmit={handleEditSubmit}
          onCancel={() => setIsEditing(false)}
          toggleTag={toggleTag}
          isEditing={true}
        />
      )}
    </div>
  </div>
)}
    </div>
  );
}

export default Machines;
