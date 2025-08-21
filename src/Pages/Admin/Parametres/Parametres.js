import React, { useEffect, useState } from "react";
import ArticleTagsSection from "./ArticlesTagsSection";
import BroderieTagsSection from "./BroderieTagsSection";
import { supabase } from "../../../supabaseClient";
import "./Parametres.css";

function Parametres() {
  const [articleTags, setArticleTags] = useState([]);
  const [broderieTags, setBroderieTags] = useState([]);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const { data: articleData, error: articleError } = await supabase
        .from("articleTags")
        .select("*");

      if (articleError) {
        console.error("❌ Erreur chargement articleTags :", articleError.message);
      } else {
        console.log("✅ Tags articles chargés :", articleData);
        setArticleTags(articleData || []);
      }

      const { data: broderieData, error: broderieError } = await supabase
        .from("broderieTags")
        .select("*");

      if (broderieError) {
        console.error("❌ Erreur chargement broderieTags :", broderieError.message);
      } else {
        console.log("✅ Tags broderie chargés :", broderieData);
        setBroderieTags(broderieData || []);
      }
    } catch (err) {
      console.error("Erreur inattendue :", err);
    }
  };

  const addArticleTag = async (label, nettoyage) => {
    if (!label || label.trim() === "") {
      console.warn("⛔ Label vide, ajout ignoré.");
      return;
    }

    const { error } = await supabase
      .from("articleTags")
      .insert([{ label: label.trim(), nettoyage }]);

    if (error) {
      console.error("❌ Erreur ajout Supabase :", error.message);
    } else {
      console.log("✅ Tag ajouté, rafraîchissement en cours...");
      await fetchTags();
    }
  };

  const updateArticleTag = async (id, label, nettoyage) => {
    const { error } = await supabase
      .from("articleTags")
      .update({ label: label.trim(), nettoyage })
      .eq("id", id);

    if (error) {
      console.error("❌ Erreur mise à jour Supabase :", error.message);
    } else {
      console.log(`✅ Tag ${id} mis à jour.`);
      setArticleTags((prev) =>
        prev.map((tag) =>
          tag.id === id ? { ...tag, label: label.trim(), nettoyage } : tag
        )
      );
    }
  };

  const deleteArticleTag = async (id) => {
    const { error } = await supabase
      .from("articleTags")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("❌ Erreur suppression Supabase :", error.message);
    } else {
      console.log(`🗑️ Tag ${id} supprimé.`);
      setArticleTags((prev) => prev.filter((tag) => tag.id !== id));
    }
  };

  // 🔧 Fonctions broderie
  const addBroderieTag = async (label) => {
    if (!label || label.trim() === "") {
      console.warn("⛔ Label vide, ajout ignoré.");
      return;
    }

    const { error } = await supabase
      .from("broderieTags")
      .insert([{ label: label.trim() }]);

    if (error) {
      console.error("❌ Erreur ajout broderie :", error.message);
    } else {
      console.log("✅ Broderie ajoutée.");
      await fetchTags();
    }
  };

  const updateBroderieTag = async (id, label) => {
    const { error } = await supabase
      .from("broderieTags")
      .update({ label: label.trim() })
      .eq("id", id);

    if (error) {
      console.error("❌ Erreur mise à jour broderie :", error.message);
    } else {
      console.log(`✅ Broderie ${id} mise à jour.`);
      setBroderieTags((prev) =>
        prev.map((tag) =>
          tag.id === id ? { ...tag, label: label.trim() } : tag
        )
      );
    }
  };

  const deleteBroderieTag = async (id) => {
    const { error } = await supabase
      .from("broderieTags")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("❌ Erreur suppression broderie :", error.message);
    } else {
      console.log(`🗑️ Broderie ${id} supprimée.`);
      setBroderieTags((prev) => prev.filter((tag) => tag.id !== id));
    }
  };

  return (
    <div className="parametres-page">
      <h2>Réglage Etiquettes</h2>
      <div className="tags-sections">
        <ArticleTagsSection
          articleTags={articleTags}
          addArticleTag={addArticleTag}
          updateArticleTag={updateArticleTag}
          deleteArticleTag={deleteArticleTag}
        />
        <BroderieTagsSection
          broderieTags={broderieTags}
          addBroderieTag={addBroderieTag}
          updateBroderieTag={updateBroderieTag}
          deleteBroderieTag={deleteBroderieTag}
        />
      </div>
    </div>
  );
}

export default Parametres;
