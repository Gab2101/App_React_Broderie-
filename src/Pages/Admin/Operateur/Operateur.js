import React, { useState, useContext, useEffect } from "react";
import "./Operateur.css";
import NewButton from "../../../components/common/Newbutton";
import { EtiquettesContext } from "../../../context/EtiquettesContext";

function Operateur() {
  const { articleTags, broderieTags } = useContext(EtiquettesContext);

  const [showModal, setShowModal] = useState(false);
  const [operateurs, setOperateurs] = useState([]);
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    Pforts: [],
    photo: ""
  });
  const [editingId, setEditingId] = useState(null); // null = création, sinon id opérateur

  // Charger opérateurs
  useEffect(() => {
    fetch("http://localhost:3001/operateurs")
      .then((res) => res.json())
      .then((data) => setOperateurs(data))
      .catch((err) => console.error("Erreur chargement opérateurs:", err));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const togglePfort = (tag) => {
    setFormData((prev) => {
      const current = [...prev.Pforts];
      const index = current.indexOf(tag);
      if (index > -1) {
        current.splice(index, 1);
      } else {
        current.push(tag);
      }
      return { ...prev, Pforts: current };
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (editingId) {
      // Mode édition: PUT
      fetch(`http://localhost:3001/operateurs/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })
        .then((res) => res.json())
        .then((data) => {
          setOperateurs((prev) =>
            prev.map((op) => (op.id === editingId ? data : op))
          );
          resetForm();
        })
        .catch((err) => console.error("Erreur modification opérateur:", err));
    } else {
      // Mode création: POST
      fetch("http://localhost:3001/operateurs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })
        .then((res) => res.json())
        .then((data) => {
          setOperateurs((prev) => [...prev, data]);
          resetForm();
        })
        .catch((err) => console.error("Erreur ajout opérateur:", err));
    }
  };

  const handleDelete = () => {
    if (!editingId) return;

    const confirmDelete = window.confirm(
      "Êtes-vous sûr de vouloir supprimer cet opérateur ?"
    );
    if (!confirmDelete) return;

    fetch(`http://localhost:3001/operateurs/${editingId}`, {
      method: "DELETE"
    })
      .then(() => {
        setOperateurs((prev) => prev.filter((op) => op.id !== editingId));
        resetForm();
      })
      .catch((err) => console.error("Erreur suppression opérateur:", err));
  };

  const handleEdit = (operateur) => {
    setFormData({
      nom: operateur.nom || "",
      prenom: operateur.prenom || "",
      Pforts: operateur.Pforts || [],
      photo: operateur.photo || ""
    });
    setEditingId(operateur.id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      nom: "",
      prenom: "",
      Pforts: [],
      photo: ""
    });
    setEditingId(null);
    setShowModal(false);
  };

  return (
    <div className="operateur-page">
      <NewButton
        onClick={() => {
          resetForm();
          setShowModal(true);
        }}
      >
        Nouvel opérateur
      </NewButton>

      {/* Modale */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{editingId ? "Modifier opérateur" : "Nouvel opérateur"}</h2>
            <form className="formulaire-operateur" onSubmit={handleSubmit}>
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
                Prénom :
                <input
                  type="text"
                  name="prenom"
                  value={formData.prenom}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>Points Forts :</label>
              <div className="tags-container">
                {[...articleTags, ...broderieTags].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag ${
                      formData.Pforts.includes(tag) ? "active" : ""
                    }`}
                    onClick={() => togglePfort(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <label>
                Photo :
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </label>

              <button type="submit" className="btn-enregistrer">
                {editingId ? "Enregistrer les modifications" : "Enregistrer"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="btn-supprimer"
                  onClick={handleDelete}
                  style={{ marginTop: "10px" }}
                >
                  Supprimer cet opérateur
                </button>
              )}
            </form>

            <button
              className="btn-fermer"
              onClick={() => setShowModal(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Liste opérateurs */}
      <div className="liste-operateurs">
        {operateurs.map((op) => (
          <div
            key={op.id}
            className="carte-operateur"
            onClick={() => handleEdit(op)}
            style={{ cursor: "pointer" }}
          >
            {op.photo && (
              <img
                src={op.photo}
                alt={`${op.prenom} ${op.nom}`}
                className="photo-operateur"
              />
            )}
            <h3>
              {op.prenom} {op.nom}
            </h3>
            {op.Pforts?.length > 0 && (
              <>
                <p>
                  <strong>Points Forts :</strong>
                </p>
                <div className="tag-list">
                  {op.Pforts.map((f, i) => (
                    <span key={i} className="tag readonly">
                      {f}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Operateur;
