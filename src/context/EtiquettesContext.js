import React, { createContext, useState, useEffect } from "react";

// Création du contexte
export const EtiquettesContext = createContext();

// Provider qui gère la logique
export function EtiquettesProvider({ children }) {
  const [articleTags, setArticleTags] = useState([]);
  const [broderieTags, setBroderieTags] = useState([]);

  // Charger depuis json-server au démarrage
  useEffect(() => {
    fetch("http://localhost:3001/etiquettes")
      .then((res) => res.json())
      .then((data) => {
        setArticleTags(data.articleTags || []);
        setBroderieTags(data.broderieTags || []);
      })
      .catch((err) =>
        console.error("Erreur chargement des étiquettes :", err)
      );
  }, []);

  // Fonction pour sauvegarder les changements
  const saveTags = (newArticles, newBroderies) => {
    setArticleTags(newArticles);
    setBroderieTags(newBroderies);

    fetch("http://localhost:3001/etiquettes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleTags: newArticles,
        broderieTags: newBroderies
      })
    })
      .then((res) => res.json())
      .then(() => console.log("Étiquettes mises à jour"))
      .catch((err) =>
        console.error("Erreur sauvegarde des étiquettes :", err)
      );
  };

  return (
    <EtiquettesContext.Provider
      value={{
        articleTags,
        broderieTags,
        setArticleTags,
        setBroderieTags,
        saveTags
      }}
    >
      {children}
    </EtiquettesContext.Provider>
  );
}
