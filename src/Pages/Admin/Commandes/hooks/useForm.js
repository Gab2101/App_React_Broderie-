// src/Pages/Admin/Commandes/hooks/useForm.js
import { useState } from "react";

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
