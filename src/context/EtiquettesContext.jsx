// src/context/EtiquettesContext.jsx
import React, { createContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { useError } from "../hooks/useError";

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

  // Use the error handling hook
  const { handleError } = useError();

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
          setBroderieTags((prev) => {
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
    try {
      const { data, error: err } = await supabase
        .from("articleTags")
        .insert([{ label: String(label ?? "").trim(), nettoyage }])
        .select()
        .single();

      if (err) throw err;

      // Évite la double‑insertion si le realtime arrive avant :
      setArticleTags((prev) => sortByLabel(upsertById(prev, data)));
      return data;
    } catch (error) {
      handleError(error, { context: 'Ajout étiquette article' });
      return null;
    }
  }, [handleError]);

  const updateArticleTag = useCallback(async (id, label, nettoyage) => {
    try {
      const { data, error: err } = await supabase
        .from("articleTags")
        .update({ label: String(label ?? "").trim(), nettoyage })
        .eq("id", id)
        .select()
        .single();

      if (err) throw err;

      setArticleTags((prev) => sortByLabel(upsertById(prev, data)));
      return data;
    } catch (error) {
      handleError(error, { context: 'Mise à jour étiquette article' });
      return null;
    }
  }, [handleError]);

  const deleteArticleTag = useCallback(async (id) => {
    try {
      const { error: err } = await supabase.from("articleTags").delete().eq("id", id);
      if (err) throw err;

      setArticleTags((prev) => removeById(prev, id));
      return true;
    } catch (error) {
      handleError(error, { context: 'Suppression étiquette article' });
      return false;
    }
  }, [handleError]);

  /* =========================
     CRUD — broderieTags
  ========================== */
  const addBroderieTag = useCallback(async (label) => {
    try {
      const { data, error: err } = await supabase
        .from("broderieTags")
        .insert([{ label: String(label ?? "").trim() }])
        .select()
        .single();

      if (err) throw err;

      setBroderieTags((prev) => sortByLabel(upsertById(prev, data)));
      return data;
    } catch (error) {
      handleError(error, { context: 'Ajout étiquette broderie' });
      return null;
    }
  }, [handleError]);

  const updateBroderieTag = useCallback(async (id, label) => {
    try {
      const { data, error: err } = await supabase
        .from("broderieTags")
        .update({ label: String(label ?? "").trim() })
        .eq("id", id)
        .select()
        .single();

      if (err) throw err;

      setBroderieTags((prev) => sortByLabel(upsertById(prev, data)));
      return data;
    } catch (error) {
      handleError(error, { context: 'Mise à jour étiquette broderie' });
      return null;
    }
  }, [handleError]);

  const deleteBroderieTag = useCallback(async (id) => {
    try {
      const { error: err } = await supabase.from("broderieTags").delete().eq("id", id);
      if (err) throw err;

      setBroderieTags((prev) => removeById(prev, id));
      return true;
    } catch (error) {
      handleError(error, { context: 'Suppression étiquette broderie' });
      return false;
    }
  }, [handleError]);

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
