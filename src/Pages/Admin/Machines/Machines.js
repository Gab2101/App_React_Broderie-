// src/pages/Machines/Machines.js
import React, { useState, useEffect, useContext, useCallback, useMemo } from "react";
import "./Machines.css";
import "../../../styles/Common.css";
import { EtiquettesContext } from "../../../context/EtiquettesContext";
import NewButton from "../../../components/common/NewButton";
import { supabase } from "../../../supabaseClient";
import MachinesCard from "./MachinesCard";
import MachinesForm from "./MachinesForm";

/* =========================
   Helpers
========================= */
const safeParseEtiquettes = (raw) => {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (raw == null) return [];
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

const sortByName = (arr) =>
  [...arr].sort((a, b) => String(a?.nom ?? "").localeCompare(String(b?.nom ?? ""), "fr", { sensitivity: "base" }));

export default function Machines() {
  const { articleTags, broderieTags } = useContext(EtiquettesContext);

  const validTagSet = useMemo(() => {
    const all = [...(articleTags || []), ...(broderieTags || [])].map((t) => t.label);
    return new Set(all.filter(Boolean));
  }, [articleTags, broderieTags]);

  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModalForm, setShowModalForm] = useState(false);
  const [machineDetails, setMachineDetails] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ nom: "", nbTetes: "", etiquettes: [] });

  // État pour la barre de recherche
  const [searchQuery, setSearchQuery] = useState('');

  /* =========================
     Load machines + normalize
  ========================= */
  const loadMachines = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("machines")
      .select("id, nom, nbTetes, etiquettes")
      .order("nom", { ascending: true });

    if (error) {
      console.error("Erreur chargement machines :", error);
      setLoading(false);
      return;
    }

    const normalized = (data || []).map((m) => {
      const etiq = uniq(safeParseEtiquettes(m.etiquettes)).filter((t) => validTagSet.has(t));
      return { ...m, etiquettes: etiq };
    });

    setMachines(sortByName(normalized));
    setLoading(false);
  }, [validTagSet]);

  useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  /* =========================
     Realtime Supabase
  ========================= */
  useEffect(() => {
    const ch = supabase
      .channel("realtime-machines")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "machines" },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          setMachines((prev) => {
            if (eventType === "INSERT" || eventType === "UPDATE") {
              const etiq = uniq(safeParseEtiquettes(newRow?.etiquettes)).filter((t) => validTagSet.has(t));
              const row = { ...newRow, etiquettes: etiq };
              const idx = prev.findIndex((m) => m.id === row.id);
              if (idx === -1) return sortByName([...prev, row]);
              const copy = [...prev];
              copy[idx] = row;
              return sortByName(copy);
            }
            if (eventType === "DELETE") {
              return prev.filter((m) => m.id !== oldRow?.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [validTagSet]);

  /* =========================
     Form helpers
  ========================= */
  const openCreate = useCallback(() => {
    setFormData({ nom: "", nbTetes: "", etiquettes: [] });
    setShowModalForm(true);
    setMachineDetails(null);
    setIsEditing(false);
  }, []);

  const openDetails = useCallback((m) => {
    setMachineDetails(m);
    setFormData({
      nom: m.nom ?? "",
      nbTetes: m.nbTetes ?? "",
      etiquettes: Array.isArray(m.etiquettes) ? m.etiquettes : [],
    });
    setIsEditing(false);
  }, []);

  const closeModal = useCallback(() => {
    setShowModalForm(false);
    setMachineDetails(null);
    setIsEditing(false);
  }, []);

  // Accessibilité : fermer la modale avec Esc
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === 'etiquettes') {
      // Gérer le cas spécial des étiquettes (array)
      const cleanedEtiquettes = Array.isArray(value) 
        ? value.filter(t => validTagSet.has(t))
        : [];
      setFormData((prev) => ({ ...prev, etiquettes: cleanedEtiquettes }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  }, [validTagSet]);

  const toggleTag = useCallback(
    (label) => {
      setFormData((prev) => {
        const next = new Set(prev.etiquettes || []);
        if (next.has(label)) next.delete(label);
        else next.add(label);
        // on ne garde que les tags valides
        const cleaned = uniq([...next]).filter((t) => validTagSet.has(t));
        return { ...prev, etiquettes: cleaned };
      });
    },
    []
  );

  /* =========================
     Create / Update / Delete
  ========================= */
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const payload = {
        nom: String(formData.nom ?? "").trim(),
        nbTetes: formData.nbTetes === "" ? null : parseInt(formData.nbTetes, 10),
        etiquettes: uniq(formData.etiquettes).filter((t) => validTagSet.has(t)),
      };

      // Optimistic insert (temp id)
      const tempId = `tmp_${Date.now()}`;
      const optimisticRow = { id: tempId, ...payload };
      setMachines((prev) => sortByName([...prev, optimisticRow]));

      const { data, error } = await supabase.from("machines").insert([payload]).select().single();

      if (error) {
        console.error("Erreur ajout machine :", error);
        // rollback
        setMachines((prev) => prev.filter((m) => m.id !== tempId));
        return;
      }

      const etiq = uniq(safeParseEtiquettes(data.etiquettes)).filter((t) => validTagSet.has(t));
      setMachines((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return sortByName([...withoutTemp, { ...data, etiquettes: etiq }]);
      });

      setFormData({ nom: "", nbTetes: "", etiquettes: [] });
      setShowModalForm(false);
    },
    [formData, validTagSet]
  );

  const handleEditSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!machineDetails) return;

      const payload = {
        nom: String(formData.nom ?? "").trim(),
        nbTetes: formData.nbTetes === "" ? null : parseInt(formData.nbTetes, 10),
        etiquettes: uniq(formData.etiquettes).filter((t) => validTagSet.has(t)),
      };

      // Optimistic update
      setMachines((prev) =>
        sortByName(
          prev.map((m) => (m.id === machineDetails.id ? { ...m, ...payload } : m))
        )
      );

      const { data, error } = await supabase
        .from("machines")
        .update(payload)
        .eq("id", machineDetails.id)
        .select()
        .single();

      if (error) {
        console.error("Erreur modification machine :", error);
        // recharge prudente
        await loadMachines();
        return;
      }

      const etiq = uniq(safeParseEtiquettes(data.etiquettes)).filter((t) => validTagSet.has(t));
      setMachines((prev) =>
        sortByName(prev.map((m) => (m.id === data.id ? { ...data, etiquettes: etiq } : m)))
      );

      setMachineDetails(null);
      setIsEditing(false);
    },
    [formData, machineDetails, loadMachines, validTagSet]
  );

  const handleDelete = useCallback(
    async (id) => {
      if (!id) return;
      if (!window.confirm("Confirmer la suppression ?")) return;

      // Optimistic delete
      const snapshot = machines;
      setMachines((prev) => prev.filter((m) => m.id !== id));

      const { error } = await supabase.from("machines").delete().eq("id", id);
      if (error) {
        console.error("Erreur suppression machine :", error);
        setMachines(snapshot); // rollback
        return;
      }
      setMachineDetails(null);
    },
    [machines]
  );

  /* =========================
     Search functionality
  ========================= */
  const filteredMachines = useMemo(() => {
    if (!searchQuery.trim()) {
      return machines;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return machines.filter(machine => {
      // Recherche par nom
      const nameMatch = machine.nom?.toLowerCase().includes(query);
      
      // Recherche par nombre de têtes
      const nbTetesMatch = String(machine.nbTetes || '').includes(query);
      
      // Recherche par étiquettes
      const etiquettesMatch = machine.etiquettes?.some(tag => 
        tag.toLowerCase().includes(query)
      );
      
      return nameMatch || nbTetesMatch || etiquettesMatch;
    });
  }, [machines, searchQuery]);

  /* =========================
     UI
  ========================= */
  return (
    <div className="machines-page">
      <div className="header-row">
        <NewButton onClick={openCreate}>Nouvelle machine</NewButton>
        {loading && <span className="muted">Chargement…</span>}
      </div>

      {/* Barre de recherche */}
      <div className="search-bar-container">
        <input
          type="text"
          placeholder="Rechercher une machine par nom, têtes ou étiquette..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          aria-label="Rechercher une machine"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="clear-search-btn"
            aria-label="Effacer la recherche"
            title="Effacer la recherche"
          >
            ×
          </button>
        )}
      </div>

      {/* Liste des machines */}
      <div className="liste-machines">
        {filteredMachines.map((machine) => (
          <MachinesCard
            key={machine.id}
            machine={machine}
            articleTags={articleTags}
            broderieTags={broderieTags}
            onClick={openDetails}
          />
        ))}
        {!loading && filteredMachines.length === 0 && searchQuery && (
          <div className="empty-state">
            Aucune machine trouvée pour "{searchQuery}".
            <button 
              onClick={() => setSearchQuery('')}
              style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
            >
              Effacer la recherche
            </button>
          </div>
        )}
        {!loading && machines.length === 0 && !searchQuery && (
          <div className="empty-state">Aucune machine enregistrée.</div>
        )}
      </div>

      {/* Modale création */}
      {showModalForm && (
        <div className="modal-overlay" onClick={closeModal} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <MachinesForm
              formData={formData}
              articleTags={articleTags}
              broderieTags={broderieTags}
              onChange={handleChange}
              onSubmit={handleSubmit}
              onCancel={closeModal}
              toggleTag={toggleTag}
              isEditing={false}
            />
          </div>
        </div>
      )}

      {/* Modale consultation / édition */}
      {machineDetails && (
        <div className="modal-overlay" onClick={closeModal} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {!isEditing ? (
              <>
                <h2>{machineDetails.nom}</h2>
                <p>
                  <strong>Nombre de têtes :</strong>{" "}
                  {machineDetails.nbTetes ?? <em>—</em>}
                </p>

                {(machineDetails.etiquettes || []).length > 0 && (
                  <>
                    <div className="etiquettes-section">
                      <p><strong>Articles :</strong></p>
                      <div className="tag-list">
                        {(machineDetails.etiquettes || [])
                          .filter((t) => (articleTags || []).some((a) => a.label === t))
                          .map((t, i) => (
                            <span key={`art-${i}`} className="tag readonly">{t}</span>
                          ))}
                      </div>
                    </div>

                    <div className="etiquettes-section">
                      <p><strong>Options de broderie :</strong></p>
                      <div className="tag-list">
                        {(machineDetails.etiquettes || [])
                          .filter((t) => (broderieTags || []).some((b) => b.label === t))
                          .map((t, i) => (
                            <span key={`brd-${i}`} className="tag readonly">{t}</span>
                          ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="btn-zone">
                  <button onClick={() => setIsEditing(true)} className="btn-enregistrer">Modifier</button>
                  <button onClick={() => handleDelete(machineDetails.id)} className="btn-fermer">Supprimer</button>
                  <button onClick={closeModal} className="btn-fermer">Fermer</button>
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
