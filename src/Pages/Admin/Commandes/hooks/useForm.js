// src/Pages/Admin/Commandes/hooks/useForm.js
import { useState } from "react";

export default function useForm(initialState = {}) {
  const defaultEmptyForm = {
    id: null,
    numero: "",
    client: "",
    quantite: "",        // laissé vide pour les inputs contrôlés
    points: "",
    urgence: 3,
    dateLivraison: "",   // "YYYY-MM-DD" (provenant d'un input date)
    types: [],
    options: [],
    vitesseMoyenne: "",
  };

  const emptyForm = { ...defaultEmptyForm, ...initialState };

  const [formData, setFormData] = useState(emptyForm);
  const [saved, setSaved] = useState(false);

  // Force une date à minuit (00:00) du jour local (Europe/Paris côté app)
  const parisAtMidnight = (dateLike) => {
    const d = new Date(dateLike);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  };

  const handleChange = (nameOrEvent, value) => {
    let name, val;
    if (typeof nameOrEvent === "string") {
      name = nameOrEvent;
      val = value;
    } else {
      const e = nameOrEvent;
      name = e.target.name;
      val = e.target.value;
    }
    setFormData((prev) => {
      // Coercition douce : si champ numérique, on stocke un nombre (ou "")
      if (["quantite", "points", "vitesseMoyenne"].includes(name)) {
        return { ...prev, [name]: val === "" ? "" : Number(val) };
      }
      if (name === "urgence") {
        return { ...prev, urgence: val === "" ? "" : Number(val) };
      }
      return { ...prev, [name]: val };
    });
  };

  const handleDateChange = (e) => {
    const value = e.target.value; // "YYYY-MM-DD"
    if (!value) {
      setFormData((prev) => ({ ...prev, dateLivraison: "", urgence: 3 }));
      return;
    }

    const selectedDate = parisAtMidnight(value);
    const today = parisAtMidnight(new Date());

    // Différence en jours calendaires (pas impactée par l'heure courante)
    const diffDays = Math.ceil((selectedDate - today) / (1000 * 60 * 60 * 24));

    let urgence = 1;
    if (diffDays < 2) urgence = 5;
    else if (diffDays < 5) urgence = 4;
    else if (diffDays < 10) urgence = 3;
    else if (diffDays < 15) urgence = 2;

    setFormData((prev) => ({
      ...prev,
      dateLivraison: value, // on conserve le string "YYYY-MM-DD" pour l'input
      urgence,
    }));
  };

  const toggleTag = (type, tag) => {
    setFormData((prev) => {
      const current = Array.isArray(prev[type]) ? [...prev[type]] : [];
      const index = current.indexOf(tag);
      if (index > -1) current.splice(index, 1);
      else current.push(tag);
      return { ...prev, [type]: current };
    });
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return {
    emptyForm,
    formData,
    setFormData,
    handleChange,
    handleDateChange,
    toggleTag,
    resetForm,
    saved,
    setSaved,
  };
}
