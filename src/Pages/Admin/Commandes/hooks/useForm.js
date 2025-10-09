// src/Pages/Admin/Commandes/hooks/useForm.js
import { useState, useCallback } from "react";
import { calculateDeliveryDateAndUrgency } from "@/utils/dateCalculations";

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

    const { date, urgence } = calculateDeliveryDateAndUrgency(value);

    setFormData((prev) => ({
      ...prev,
      dateLivraison: date, // Keep string format for form input
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
