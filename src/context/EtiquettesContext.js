// src/context/EtiquettesContext.js
import React, { createContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient";

export const EtiquettesContext = createContext({
  articleTags: [],
  broderieTags: [],
  loading: true,
  error: null,
  refreshEtiquettes: async () => {},
  addArticleTag: async () => {},
  updateArticleTag: async () => {},
  deleteArticleTag: async () => {},
  addBroderieTag: async () => {},
  updateBroderieTag: async () => {},
  deleteBroderieTag: async () => {},
});

export function EtiquettesProvider({ children }) {
  const [articleTags, setArticleTags] = useState([]);
  const [broderieTags, setBroderieTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* =========================
     Helpers immuables
  ========================== */
  const upsertById = (arr, row) => {
    if (!row || row.id == null) return arr;
    const idx = arr.findIndex((x) => x.id === row.id);
    if (idx === -1) return [...arr, row];
    const next = [...arr];
    next[idx] = row;
    return next;
  };

  const removeById = (arr, id) => arr.filter((x) => x.id !== id);

  const sortByLabel = (arr) =>
    [...arr].sort((a, b) => String(a?.label ?? "").localeCompare(String(b?.label ?? ""), "fr", { sensitivity: "base" }));

  /* =========================
     Chargement initial + refresh
  ========================== */
  const refreshEtiquettes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: articles, error: errorArticles }, { data: brods, error: errorBrods }] = await Promise.all([
        supabase.from("articleTags").select("*").order("label", { ascending: true }),
        supabase.from("broderieTags").select("*").order("label", { ascending: true }),
      ]);

      if (errorArticles) throw errorArticles;
      if (errorBrods) throw errorBrods;

      setArticleTags(articles ?? []);
      setBroderieTags(brods ?? []);
    } catch (e) {
      console.error("Erreur chargement étiquettes :", e);
      setError(e?.message || "Erreur de chargement des étiquettes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshEtiquettes();
  }, [refreshEtiquettes]);

  /* =========================
     Realtime Supabase
  ========================== */
  useEffect(() => {
    // Channel articleTags
    const chArticles = supabase
      .channel("realtime-articleTags")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "articleTags" },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          setArticleTags((prev) => {
            if (eventType === "INSERT" || eventType === "UPDATE") {
              const next = upsertById(prev, newRow);
              return sortByLabel(next);
            }
            if (eventType === "DELETE") {
              return removeById(prev, oldRow?.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    // Channel broderieTags
    const chBrods = supabase
      .channel("realtime-broderieTags")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "broderieTags" },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          setBroderieTags((prev) =>{
            if (eventType === "INSERT" || eventType === "UPDATE") {
              const next = upsertById(prev, newRow);
              return sortByLabel(next);
            }
            if (eventType === "DELETE") {
              return removeById(prev, oldRow?.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chArticles);
      supabase.removeChannel(chBrods);
    };
  }, []);

  /* =========================
     CRUD — articleTags
  ========================== */
  const addArticleTag = useCallback(async (label, nettoyage) => {
    // ⬇️ Si ta colonne s’appelle nettoyage_minutes, remplace "nettoyage" par "nettoyage_minutes"
    const { data, error: err } = await supabase
      .from("articleTags")
      .insert([{ label: String(label ?? "").trim(), nettoyage }])
      .select()
      .single();

    if (err) {
      console.error("Erreur ajout article:", err);
      setError(err.message);
      return null;
    }
    // Évite la double‑insertion si le realtime arrive avant :
    setArticleTags((prev) => sortByLabel(upsertById(prev, data)));
    return data;
  }, []);

  const updateArticleTag = useCallback(async (id, label, nettoyage) => {
    const { data, error: err } = await supabase
      .from("articleTags")
      .update({ label: String(label ?? "").trim(), nettoyage })
      .eq("id", id)
      .select()
      .single();

    if (err) {
      console.error("Erreur mise à jour article:", err);
      setError(err.message);
      return null;
    }
    setArticleTags((prev) => sortByLabel(upsertById(prev, data)));
    return data;
  }, []);

  const deleteArticleTag = useCallback(async (id) => {
    const { error: err } = await supabase.from("articleTags").delete().eq("id", id);
    if (err) {
      console.error("Erreur suppression article:", err);
      setError(err.message);
      return false;
    }
    setArticleTags((prev) => removeById(prev, id));
    return true;
  }, []);

  /* =========================
     CRUD — broderieTags
  ========================== */
  const addBroderieTag = useCallback(async (label) => {
    const { data, error: err } = await supabase
      .from("broderieTags")
      .insert([{ label: String(label ?? "").trim() }])
      .select()
      .single();

    if (err) {
      console.error("Erreur ajout broderieTag :", err);
      setError(err.message);
      return null;
    }
    setBroderieTags((prev) => sortByLabel(upsertById(prev, data)));
    return data;
  }, []);

  const updateBroderieTag = useCallback(async (id, label) => {
    const { data, error: err } = await supabase
      .from("broderieTags")
      .update({ label: String(label ?? "").trim() })
      .eq("id", id)
      .select()
      .single();

    if (err) {
      console.error("Erreur mise à jour broderieTag :", err);
      setError(err.message);
      return null;
    }
    setBroderieTags((prev) => sortByLabel(upsertById(prev, data)));
    return data;
  }, []);

  const deleteBroderieTag = useCallback(async (id) => {
    const { error: err } = await supabase.from("broderieTags").delete().eq("id", id);
    if (err) {
      console.error("Erreur suppression broderieTag :", err);
      setError(err.message);
      return false;
    }
    setBroderieTags((prev) => removeById(prev, id));
    return true;
  }, []);

  /* =========================
     Valeur de contexte mémoïsée
  ========================== */
  const value = useMemo(
    () => ({
      articleTags,
      broderieTags,
      loading,
      error,
      refreshEtiquettes,
      addArticleTag,
      updateArticleTag,
      deleteArticleTag,
      addBroderieTag,
      updateBroderieTag,
      deleteBroderieTag,
    }),
    [
      articleTags,
      broderieTags,
      loading,
      error,
      refreshEtiquettes,
      addArticleTag,
      updateArticleTag,
      deleteArticleTag,
      addBroderieTag,
      updateBroderieTag,
      deleteBroderieTag,
    ]
  );

  return <EtiquettesContext.Provider value={value}>{children}</EtiquettesContext.Provider>;
}
