import React, { useState, useEffect, useContext, useMemo } from "react";
import "../../../styles/Commandes.css";
import { EtiquettesContext } from "../../../context/EtiquettesContext";
import NewButton from "../../../components/common/NewButton";
import { supabase } from "../../../supabaseClient";
import {
  getNextFullHour,
  convertDecimalToTime,
  convertHoursToHHMM,
  nextWorkStart,
  addWorkingHours,
} from "../../../utils/time";
import { calculerDurees } from "../../../utils/calculs";

/* ======================================
   Helpers de normalisation pour étiquettes
====================================== */
const normalizeOne = (v) => {
  if (v == null) return null;
  if (typeof v === "string") return v.trim().toLowerCase();
  if (typeof v === "object") {
    const cand = v.label ?? v.name ?? v.value ?? null;
    return cand ? String(cand).trim().toLowerCase() : null;
  }
  return String(v).trim().toLowerCase();
};

const toLabelArray = (raw) => {
  if (!raw) return [];
  try {
    if (Array.isArray(raw)) return raw.map(normalizeOne).filter(Boolean);
    if (typeof raw === "string") {
      const s = raw.trim();
      if (s.startsWith("[") && s.endsWith("]")) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(normalizeOne).filter(Boolean);
      }
      return s.split(",").map(normalizeOne).filter(Boolean);
    }
    return [normalizeOne(raw)].filter(Boolean);
  } catch {
    return [];
  }
};

/* ======================================
   Helpers commande liée
====================================== */
// Dernière fin planifiée d'une commande (ou null si rien) + machineId portée par planning
const getLinkedLastFinishAndMachineId = (planningArr, commandeId) => {
  const rows = (planningArr || []).filter((p) => p.commandeId === commandeId);
  if (!rows.length) return { lastFinish: null, machineId: null };
  rows.sort((a, b) => new Date(a.fin) - new Date(b.fin));
  const last = rows[rows.length - 1];
  return { lastFinish: new Date(last.fin), machineId: last.machineId ?? null };
};

// Retrouve machine par son nom lisible (machineAssignee)
const getMachineByName = (machinesArr, name) =>
  machinesArr.find(
    (m) => (m.nom || "").trim().toLowerCase() === String(name || "").trim().toLowerCase()
  ) || null;

/* =========================
   Composant principal
========================= */
function Commandes() {
  const [showModal, setShowModal] = useState(false);
  const [commandes, setCommandes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [planning, setPlanning] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [saved, setSaved] = useState(false);

  const [selectedScenario, setSelectedScenario] = useState(null);
  const [machineAssignee, setMachineAssignee] = useState(null);

  const { articleTags, broderieTags } = useContext(EtiquettesContext);

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
    vitesseMoyenne: "", // PPM par tête
  };

  const [formData, setFormData] = useState(emptyForm);

  // --- LIAISON COMMANDE ---
  const [isLinked, setIsLinked] = useState(false);
  const [linkedCommandeId, setLinkedCommandeId] = useState(null);
  const [sameMachineAsLinked, setSameMachineAsLinked] = useState(false);
  const [startAfterLinked, setStartAfterLinked] = useState(true);
  const [linkableCommandes, setLinkableCommandes] = useState([]);

  /* =========================
     Chargement des données
  ========================= */
  const reloadData = async () => {
    try {
      const [{ data: commandesData, error: err1 }, { data: machinesData, error: err2 }, { data: planningData, error: err3 }] =
        await Promise.all([
          supabase.from("commandes").select("*"),
          supabase.from("machines").select("*"),
          supabase.from("planning").select("*"),
        ]);

      if (err1 || err2 || err3) {
        console.error("Erreur chargement données:", err1, err2, err3);
        return;
      }

      setCommandes(commandesData || []);
      setMachines(machinesData || []);
      setPlanning(planningData || []);

      // commandes éligibles au chaînage
      const { data: cmdLinkables, error: errLink } = await supabase
        .from("commandes")
        .select("id, numero, client, statut, machineAssignee")
        .in("statut", ["A commencer", "En cours"]);

      if (!errLink) setLinkableCommandes(cmdLinkables || []);
    } catch (err) {
      console.error("Erreur reloadData:", err);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  /* =========================
     Formulaire
  ========================= */
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

    if (parseInt(formData.quantite, 10) <= 0 || parseInt(formData.points, 10) <= 0) {
      alert("La quantité et le nombre de points doivent être supérieurs à zéro.");
      return;
    }

    if (formData.id) {
      await handleUpdateCommande();
      return;
    }

    await handleSimulation();
  };

  const handleUpdateCommande = async () => {
    const { error: updateError } = await supabase
      .from("commandes")
      .update(formData)
      .eq("id", formData.id);

    if (updateError) {
      alert("Erreur lors de la mise à jour.");
      console.error(updateError);
      return;
    }

    reloadData();
    resetForm();
  };

  /* =========================
     Simulation d'affectation
  ========================= */
  const handleSimulation = async () => {
    // 1) Normalise les besoins
    const neededTypes = toLabelArray(formData.types);
    const neededOptions = toLabelArray(formData.options);

    // 2) Prépare la liste des machines avec étiquettes normalisées
    const machinesWithLabels = machines.map((m) => ({
      ...m,
      _labels: toLabelArray(m.etiquettes),
    }));

    // --- Contraintes si commande liée ---
    let debutMinOverride = null; // si on ancre après la liée
    let forcedMachine = null; // si "même brodeuse" imposée

    if (isLinked && linkedCommandeId) {
      const linkedIdNum = Number(linkedCommandeId);

      // 1) récupérer fin & machine de la liée (depuis state planning)
      const { lastFinish, machineId: linkedMachineId } = getLinkedLastFinishAndMachineId(
        planning,
        linkedIdNum
      );

      // 2) ancrage de début
      if (startAfterLinked) {
        // si la liée a des blocs -> ancre à sa fin, sinon maintenant arrondi ouvré
        debutMinOverride = lastFinish ? nextWorkStart(lastFinish) : getNextFullHour();
      }

      // 3) même brodeuse
      if (sameMachineAsLinked) {
        // cas A: la liée a déjà une machine dans le planning
        if (linkedMachineId) {
          forcedMachine = machines.find((m) => m.id === linkedMachineId) || null;
        } else {
          // cas B: pas encore planifiée ; essayer avec son machineAssignee (nom)
          const linkedCmd = commandes.find((c) => c.id === linkedIdNum);
          if (linkedCmd?.machineAssignee) {
            forcedMachine = getMachineByName(machines, linkedCmd.machineAssignee);
          }
        }

        if (!forcedMachine) {
          alert(
            "La commande liée n'a pas encore de brodeuse fixée. Planifie-la d'abord ou décoche 'même brodeuse'."
          );
          return;
        }
      }
    }

    // 3) Filtre strict (types + options), en respectant éventuellement la machine imposée
    const compatiblesStrict = machinesWithLabels.filter((m) => {
      if (forcedMachine && m.id !== forcedMachine.id) return false;
      const hasTypes = neededTypes.every((t) => m._labels.includes(t));
      const hasOptions = neededOptions.every((o) => m._labels.includes(o));
      return hasTypes && hasOptions;
    });

    // 4) Fallback : types seulement (toujours en respectant forcedMachine si présent)
    const compatibles =
      compatiblesStrict.length > 0
        ? compatiblesStrict
        : machinesWithLabels.filter((m) => {
            if (forcedMachine && m.id !== forcedMachine.id) return false;
            return neededTypes.every((t) => m._labels.includes(t));
          });

    if (compatibles.length === 0) {
      alert("Aucune machine compatible. Vérifie 'types' / 'options' (casse/espaces).");
      console.debug("[DEBUG] types demandés:", neededTypes);
      console.debug("[DEBUG] options demandées:", neededOptions);
      console.debug(
        "[DEBUG] machines & étiquettes:",
        machinesWithLabels.map((m) => ({ id: m.id, nom: m.nom, labels: m._labels }))
      );
      return;
    }

    // 5) Scénarios par machine compatible
    const scenariosLocaux = [];
    for (const m of compatibles) {
      // Ne conserver que les blocs futurs/en cours
      const now = Date.now();
      const planifies = (planning || [])
        .filter((p) => p.machineId === m.id && new Date(p.fin).getTime() >= now)
        .sort((a, b) => new Date(a.debut) - new Date(b.debut));

      const nowDispo = getNextFullHour();
      const lastFin = planifies.length ? new Date(planifies[planifies.length - 1].fin) : null;
      const anchorBase = lastFin && lastFin > nowDispo ? lastFin : nowDispo;

      // Si on a un début minimal imposé (après la liée), on prend le max(anchorBase, debutMinOverride)
      const anchor =
        debutMinOverride && debutMinOverride > anchorBase ? debutMinOverride : anchorBase;

      const debut = nextWorkStart(anchor);

      const etiquetteArticle = formData.types?.[0];
      const etiquetteDetail = (Array.isArray(articleTags) ? articleTags : []).find(
        (tag) => normalizeOne(tag.label) === normalizeOne(etiquetteArticle)
      );

      const { dureeBroderieHeures, dureeNettoyageHeures, dureeTotaleHeures } = calculerDurees({
        quantite: Number(formData.quantite || 0),
        points: Number(formData.points || 0),
        vitesse: Number(formData.vitesseMoyenne || 680), // PPM par tête
        nbTetes: Number(m.nbTetes || 1),
        nettoyageParArticleSec: etiquetteDetail ? Number(etiquetteDetail.nettoyage || 0) : 0,
      });

      const dureeTotaleHeuresArrondie = Math.ceil(dureeTotaleHeures);
      const fin = addWorkingHours(debut, dureeTotaleHeuresArrondie);

      scenariosLocaux.push({
        machine: m,
        debut,
        fin,
        dureeBroderieHeures,
        dureeNettoyageHeures,
        dureeTotaleHeuresReelle: dureeTotaleHeures,
        dureeTotaleHeuresArrondie,
      });
    }

    // 6) Choisir la machine qui finit le plus tôt
    scenariosLocaux.sort((a, b) => a.fin - b.fin);
    const meilleur = scenariosLocaux[0];

    setScenarios(scenariosLocaux);
    setSelectedScenario(meilleur);
    setMachineAssignee(meilleur.machine.id);
    setShowModal(false); // ferme la modale de création
  };

  /* Map pratique: scénario par machineId pour afficher la fin estimée dans la liste */
  const scenarioByMachineId = useMemo(() => {
    const map = new Map();
    for (const sc of scenarios) map.set(sc.machine.id, sc);
    return map;
  }, [scenarios]);

  /* =========================
     Confirmation de création
  ========================= */
  const confirmCreation = async () => {
    const machine = machines.find((m) => String(m.id) === String(machineAssignee));
    if (!machine) {
      alert("Machine invalide.");
      return;
    }

    // Validation compatibilité types (normalisée)
    {
      const machineLabels = toLabelArray(machine.etiquettes);
      const neededTypes = toLabelArray(formData.types);
      const ok = neededTypes.every((t) => machineLabels.includes(t));
      if (!ok) {
        alert("Machine incompatible (types).");
        return;
      }
    }

    // Récup infos liées pour calcul du début si besoin (enchaînement)
    let debutMinOverride = null;
    if (isLinked && linkedCommandeId && startAfterLinked) {
      const { lastFinish } = getLinkedLastFinishAndMachineId(planning, Number(linkedCommandeId));
      if (lastFinish) debutMinOverride = nextWorkStart(lastFinish);
    }

    // Si "même brodeuse", s'assurer qu'on est bien sur la machine de la liée (si connue)
    if (isLinked && sameMachineAsLinked && linkedCommandeId) {
      const { machineId: linkedMachineId } = getLinkedLastFinishAndMachineId(
        planning,
        Number(linkedCommandeId)
      );
      const linkedCmd = commandes.find((c) => c.id === Number(linkedCommandeId));
      const linkedMachineByName = linkedCmd?.machineAssignee
        ? getMachineByName(machines, linkedCmd.machineAssignee)
        : null;
      const expectedId = linkedMachineId ?? linkedMachineByName?.id ?? null;

      if (expectedId && String(machine.id) !== String(expectedId)) {
        alert("La machine sélectionnée doit être la même que celle de la commande liée.");
        return;
      }
    }

    // Recalcule pour la machine choisie
    const etiquetteArticle = formData.types?.[0];
    const etiquetteDetail = (Array.isArray(articleTags) ? articleTags : []).find(
      (tag) => normalizeOne(tag.label) === normalizeOne(etiquetteArticle)
    );
    const vitesseBase = parseInt(formData.vitesseMoyenne, 10) || 680; // PPM/tête

    const {
      dureeBroderieHeures,
      dureeNettoyageHeures,
      dureeTotaleHeures: dureeTotaleHeuresReelle,
    } = calculerDurees({
      quantite: Number(formData.quantite || 0),
      points: Number(formData.points || 0),
      vitesse: Number(vitesseBase),
      nbTetes: Number(machine.nbTetes || 1),
      nettoyageParArticleSec: etiquetteDetail ? Number(etiquetteDetail.nettoyage || 0) : 0,
    });
    const dureeTotaleHeuresArrondie = Math.ceil(dureeTotaleHeuresReelle);

    // Re-sécurise la dispo réelle avant création
    const now = Date.now();
    const planifies = (planning || [])
      .filter((p) => p.machineId === machine.id && new Date(p.fin).getTime() >= now)
      .sort((a, b) => new Date(a.debut) - new Date(b.debut));

    const nowDispo = getNextFullHour();
    const lastFin = planifies.length ? new Date(planifies[planifies.length - 1].fin) : null;
    const anchorBase = lastFin && lastFin > nowDispo ? lastFin : nowDispo;
    const anchor =
      debutMinOverride && debutMinOverride > anchorBase ? debutMinOverride : anchorBase;
    const debut = nextWorkStart(anchor);
    const fin = addWorkingHours(debut, dureeTotaleHeuresArrondie);

    const { id, ...formSansId } = formData;

    // Enregistrement commande
    const { data: createdCmd, error: errorCmd } = await supabase
      .from("commandes")
      .insert([
        {
          ...formSansId,
          machineAssignee: machine.nom, // nom lisible
          vitesseMoyenne: vitesseBase,
          // historique si encore utilisé
          dureeEstimee: dureeTotaleHeuresArrondie,
          // nouvelles colonnes
          duree_broderie_heures: dureeBroderieHeures,
          duree_nettoyage_heures: dureeNettoyageHeures,
          duree_totale_heures: dureeTotaleHeuresReelle,
          duree_totale_heures_arrondie: dureeTotaleHeuresArrondie,
          statut: "A commencer",
          // --- liaison ---
          linked_commande_id: isLinked ? Number(linkedCommandeId) : null,
          same_machine_as_linked: Boolean(isLinked && sameMachineAsLinked),
          start_after_linked: Boolean(isLinked && startAfterLinked),
        },
      ])
      .select()
      .single();

    if (errorCmd) {
      console.error("Erreur création commande:", errorCmd);
      alert(
        "Erreur lors de la création de la commande.\n" +
          (errorCmd.message || "Regarde la console pour plus de détails.")
      );
      return;
    }

    // Enregistrement planning
    const { error: errorPlanning } = await supabase.from("planning").insert([
      {
        machineId: machine.id,
        commandeId: createdCmd.id,
        debut: debut.toISOString(),
        debutTheorique: debut.toISOString(),
        fin: fin.toISOString(),
      },
    ]);

    if (errorPlanning) {
      console.error("Erreur création planning:", errorPlanning);
      alert(
        "La commande a été créée, mais l'insertion dans le planning a échoué.\n" +
          (errorPlanning.message || "")
      );
    }

    setSelectedScenario(null);
    setMachineAssignee(null);
    setShowModal(false);
    setScenarios([]);
    reloadData();
    resetForm();
  };

  /* =========================
     Statut commande
  ========================= */
  const handleChangeStatut = async (id, newStatut) => {
    const commande = commandes.find((c) => c.id === id);
    if (!commande) return;

    const maintenant = new Date();
    const formatHeure = `${String(maintenant.getHours()).padStart(2, "0")}:${String(
      maintenant.getMinutes()
    ).padStart(2, "0")}`;

    const updatedCommande = {
      ...commande,
      statut: newStatut,
      dateDebut:
        newStatut === "En cours" && !commande.dateDebut ? formatHeure : commande.dateDebut || "",
      dateFin:
        newStatut === "Terminé" && !commande.dateFin ? formatHeure : commande.dateFin || "",
    };

    const { error: updateError } = await supabase
      .from("commandes")
      .update(updatedCommande)
      .eq("id", id);

    if (updateError) {
      console.error("Erreur mise à jour statut:", updateError);
    }

    reloadData();
  };

  /* =========================
     Divers handlers
  ========================= */
  const resetForm = () => {
    setFormData(emptyForm);
    setIsLinked(false);
    setLinkedCommandeId(null);
    setSameMachineAsLinked(false);
    setStartAfterLinked(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer cette commande ?")) return;

    try {
      // 1) Récupérer tous les enregistrements planning liés
      const { data: planningServeur, error: errorPlanningSelect } = await supabase
        .from("planning")
        .select("*")
        .eq("commandeId", id);
      if (errorPlanningSelect) {
        console.error("Erreur récupération planning:", errorPlanningSelect);
      }

      // 2) Supprimer les plannings liés
      if (Array.isArray(planningServeur)) {
        for (const p of planningServeur) {
          const { error: errorDeletePlanning } = await supabase
            .from("planning")
            .delete()
            .eq("id", p.id);

          if (errorDeletePlanning) {
            console.error("Erreur suppression planning:", errorDeletePlanning);
          }
        }
      } else {
        console.warn("planningServeur n'est pas un tableau :", planningServeur);
      }

      // 3) Supprimer la commande
      const { error: deleteError } = await supabase.from("commandes").delete().eq("id", id);

      if (deleteError) {
        alert("Erreur lors de la suppression de la commande.");
        console.error(deleteError);
        return;
      }

      // 4) Recharger
      reloadData();
    } catch (err) {
      console.error("Erreur suppression:", err);
      alert("Erreur lors de la suppression.");
    }
  };

  const handleNewCommande = () => {
    resetForm();
    setShowModal(true);
    setSelectedScenario(null);
    setScenarios([]);
    setMachineAssignee(null);
  };

  /* =========================
     Rendu
  ========================= */
  return (
    <div className="commandes-page">
      <NewButton onClick={handleNewCommande}>Nouvelle commande</NewButton>

      {/* Modale création */}
      {showModal && !selectedScenario && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{formData.id ? "Modifier la commande" : "Nouvelle commande"}</h2>

            <form className="formulaire-commande" onSubmit={handleSubmit}>
              {/* ----- LIAISON A UNE COMMANDE EXISTANTE ----- */}
              <div className="bloc-liaison">
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={isLinked}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setIsLinked(val);
                      if (!val) {
                        setLinkedCommandeId(null);
                        setSameMachineAsLinked(false);
                        setStartAfterLinked(true);
                      }
                    }}
                  />
                  Cette commande est-elle liée à une commande existante ?
                </label>

                {isLinked && (
                  <>
                    <label>
                      Sélectionnez la commande liée :
                      <select
                        value={linkedCommandeId || ""}
                        onChange={(e) =>
                          setLinkedCommandeId(e.target.value ? Number(e.target.value) : null)
                        }
                      >
                        <option value="">-- choisir --</option>
                        {linkableCommandes
                          .filter((c) => !formData.id || c.id !== formData.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              #{c.numero} — {c.client} ({c.statut})
                            </option>
                          ))}
                      </select>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={sameMachineAsLinked}
                        onChange={(e) => setSameMachineAsLinked(e.target.checked)}
                        disabled={!linkedCommandeId}
                      />
                      Utiliser la même brodeuse (même machine) que la commande liée
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={startAfterLinked}
                        onChange={(e) => setStartAfterLinked(e.target.checked)}
                        disabled={!linkedCommandeId}
                      />
                      Planifier après la commande liée (enchaînement)
                    </label>
                  </>
                )}
              </div>

              {/* ----- INFOS COMMANDE ----- */}
              <label>
                Numéro de commande :
                <input
                  type="text"
                  name="numero"
                  value={formData.numero}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Client :
                <input
                  type="text"
                  name="client"
                  value={formData.client}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Quantité :
                <input
                  type="number"
                  name="quantite"
                  value={formData.quantite}
                  onChange={handleChange}
                  min="1"
                  required
                />
              </label>
              <label>
                Points :
                <input
                  type="number"
                  name="points"
                  value={formData.points}
                  onChange={handleChange}
                  min="1"
                  required
                />
              </label>
              <label>
                Vitesse moyenne (points/minute) :
                <input
                  type="number"
                  name="vitesseMoyenne"
                  value={formData.vitesseMoyenne}
                  onChange={handleChange}
                  placeholder="680"
                  min="1"
                />
              </label>
              <label>
                Date livraison :
                <input
                  type="date"
                  name="dateLivraison"
                  value={formData.dateLivraison}
                  onChange={handleDateChange}
                />
              </label>
              <label>
                Urgence :
                <select name="urgence" value={formData.urgence} onChange={handleChange}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <label>Types :</label>
              <div className="tags-container">
                {Array.isArray(articleTags) &&
                  articleTags.map((tag) => (
                    <button
                      key={tag.label}
                      type="button"
                      className={`tag ${formData.types.includes(tag.label) ? "active" : ""}`}
                      onClick={() => toggleTag("types", tag.label)}
                    >
                      {tag.label}
                    </button>
                  ))}
              </div>

              <label>Options :</label>
              <div className="tags-container">
                {Array.isArray(broderieTags) &&
                  broderieTags.map((tag) => (
                    <button
                      key={tag.id ?? tag.label}
                      type="button"
                      className={`tag ${formData.options.includes(tag.label) ? "active" : ""}`}
                      onClick={() => toggleTag("options", tag.label)}
                    >
                      {tag.label}
                    </button>
                  ))}
              </div>

              <button type="submit" className="btn-enregistrer">
                Enregistrer
              </button>
            </form>

            {saved && <div className="message-saved">✅ Enregistré</div>}
            <button className="btn-fermer" onClick={() => setShowModal(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Modale choix machine */}
      {selectedScenario && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirmer la machine</h2>
            <p>
              <strong>Machine proposée :</strong> {selectedScenario.machine.nom}
            </p>
            <p>
              <strong>Temps broderie :</strong>{" "}
              {convertHoursToHHMM(selectedScenario.dureeBroderieHeures)}
            </p>
            <p>
              <strong>Temps nettoyage :</strong>{" "}
              {convertHoursToHHMM(selectedScenario.dureeNettoyageHeures)}
            </p>
            <p>
              <strong>Temps total (réel) :</strong>{" "}
              {convertHoursToHHMM(selectedScenario.dureeTotaleHeuresReelle)} (réservé :{" "}
              {selectedScenario.dureeTotaleHeuresArrondie} h)
            </p>

            <label>Choisir une autre machine :</label>
            <select
              value={machineAssignee ?? selectedScenario.machine.id}
              onChange={(e) => setMachineAssignee(e.target.value)}
            >
              {machines
                .filter((m) => {
                  const machineLabels = toLabelArray(m.etiquettes);
                  const neededTypes = toLabelArray(formData.types);
                  return neededTypes.every((t) => machineLabels.includes(t));
                })
                .map((m) => {
                  const sc = scenarioByMachineId.get(m.id);
                  const finLabel = sc
                    ? ` — fin estimée ${new Date(sc.fin).toLocaleString("fr-FR")}`
                    : "";
                  return (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                      {finLabel}
                    </option>
                  );
                })}
            </select>

            <button onClick={confirmCreation} style={{ marginTop: "10px" }}>
              Confirmer ce choix
            </button>
          </div>
        </div>
      )}

      {/* Liste des commandes */}
      <div className="liste-commandes">
        {commandes.map((cmd) => {
          // 1) Lire d'abord la DB (nouvelles colonnes)
          let b = cmd.duree_broderie_heures;
          let n = cmd.duree_nettoyage_heures;
          let t = cmd.duree_totale_heures;

          // 2) Fallback pour anciennes commandes (colonnes nulles)
          if (b == null || n == null || t == null) {
            const articleTag = Array.isArray(articleTags)
              ? articleTags.find((tag) => cmd.types?.includes(tag.label))
              : null;
            const nettoyageSec = articleTag ? Number(articleTag.nettoyage || 0) : 0;

            const quantite = Number(cmd.quantite || 0);
            const points = Number(cmd.points || 0);
            const nbTetes = Number(
              machines.find((m) => m.nom === cmd.machineAssignee)?.nbTetes || 1
            );
            const vitessePPM = Number(cmd.vitesseMoyenne || 680); // PPM

            const calc = calculerDurees({
              quantite,
              points,
              vitesse: vitessePPM,
              nbTetes,
              nettoyageParArticleSec: nettoyageSec,
            });

            b = calc.dureeBroderieHeures;
            n = calc.dureeNettoyageHeures;
            t = calc.dureeTotaleHeures;
          }

          return (
            <div key={cmd.id} className="carte-commande">
              <h3>Commande #{cmd.numero}</h3>
              <p>
                <strong>Client :</strong> {cmd.client}
              </p>
              <p>
                <strong>Quantité :</strong> {cmd.quantite}
              </p>
              <p>
                <strong>Points :</strong> {cmd.points}
              </p>
              <p>
                <strong>Urgence :</strong> {cmd.urgence}
              </p>
              <p>
                <strong>Livraison :</strong> {cmd.dateLivraison}
              </p>
              <p>
                <strong>Statut :</strong>{" "}
                <select
                  value={cmd.statut || "A commencer"}
                  onChange={(e) => handleChangeStatut(cmd.id, e.target.value)}
                >
                  {["A commencer", "En cours", "Terminé"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </p>
              {cmd.dateDebut && (
                <p>
                  <strong>Début :</strong> {cmd.dateDebut}
                </p>
              )}
              {cmd.dateFin && (
                <p>
                  <strong>Fin :</strong> {cmd.dateFin}
                </p>
              )}
              {cmd.machineAssignee && (
                <p>
                  <strong>Machine :</strong> {cmd.machineAssignee}
                </p>
              )}

              {/* Affichage liaison si présente */}
              {(cmd.linked_commande_id || cmd.same_machine_as_linked || cmd.start_after_linked) && (
                <div className="bloc-liaison-info">
                  <strong>Liaison :</strong>{" "}
                  {cmd.linked_commande_id ? `#${cmd.linked_commande_id}` : "—"} •{" "}
                  {cmd.same_machine_as_linked ? "même brodeuse" : "brodeuse libre"} •{" "}
                  {cmd.start_after_linked ? "enchaînée après" : "non enchaînée"}
                </div>
              )}

              <p>
                <strong>Durée broderie :</strong> {convertDecimalToTime(b ?? 0)}
              </p>
              <p>
                <strong>Durée nettoyage :</strong> {convertDecimalToTime(n ?? 0)}
              </p>
              <p>
                <strong>Durée totale :</strong> {convertDecimalToTime(t ?? 0)}
              </p>

              <button
                onClick={() => {
                  setFormData({
                    ...cmd,
                    id: cmd.id,
                    quantite: String(cmd.quantite),
                    points: String(cmd.points),
                    urgence: String(cmd.urgence),
                  });
                  // Précharger les drapeaux liés si présents
                  setIsLinked(Boolean(cmd.linked_commande_id));
                  setLinkedCommandeId(cmd.linked_commande_id || null);
                  setSameMachineAsLinked(Boolean(cmd.same_machine_as_linked));
                  setStartAfterLinked(Boolean(cmd.start_after_linked ?? true));

                  setSaved(false);
                  setShowModal(true);
                  setSelectedScenario(null);
                  setScenarios([]);
                  setMachineAssignee(null);
                }}
                className="btn-enregistrer"
              >
                Modifier
              </button>
              <button onClick={() => handleDelete(cmd.id)} className="btn-fermer">
                Supprimer
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Commandes;
