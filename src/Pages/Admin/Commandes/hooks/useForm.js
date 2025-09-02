// src/Pages/Admin/Commandes/hooks/useForm.js
import { useState } from "react";

/**
 * Calcule automatiquement le niveau d'urgence basé sur la date de livraison
 */
const calculateUrgency = (dateLivraison) => {
  if (!dateLivraison) return 1;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const livraison = new Date(dateLivraison);
  livraison.setHours(0, 0, 0, 0);
  
  const diffTime = livraison.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 2) return 5;
  if (diffDays < 5) return 4;
  if (diffDays < 10) return 3;
  if (diffDays < 15) return 2;
  return 1;
};

export default function useForm() {
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
    vitesseMoyenne: "",
  };

  const [formData, setFormData] = useState(emptyForm);
  const [saved, setSaved] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e) => {
    const value = e.target.value;
    const urgence = calculateUrgency(value);

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
