import React, { useCallback, useEffect, useMemo, useState } from "react";
import ArticleTagsSection from "./ArticlesTagsSection";
import BroderieTagsSection from "./BroderieTagsSection";
import NettoyageRulesEditor from "./NettoyageRulesEditor";
import { supabase } from "../../../supabaseClient";
import "./Parametres.css";

/**
 * Parametres
 * — Centralise le chargement/MAJ des tags Article & Broderie
 * — Ajoute l’éditeur des règles de nettoyage (article × zone)
 * — Realtime sur nettoyage_rules pour MAJ du compteur
 * — Suppression en cascade des règles liées aux tags supprimés (optionnelle)
 */
export default function Parametres() {
  const [articleTags, setArticleTags] = useState([]);
  const [broderieTags, setBroderieTags] = useState([]);
  const [rulesCount, setRulesCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🔒 Hot-fix : empêcher tout submit involontaire dans la page
  useEffect(() => {
    const onSubmit = (e) => {
      const root = document.querySelector(".parametres-page");
      if (root && root.contains(e.target)) {
        e.preventDefault(); // annule navigation/reload
      }
    };
    document.addEventListener("submit", onSubmit, true); // capture
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  // Helpers
  const sanitizeLabel = useCallback((v) => String(v ?? "").trim(), []);
  const normalize = useCallback((s) => String(s ?? "").trim().toLowerCase(), []);

  const sortByLabel = useCallback(
    (a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }),
    []
  );

  const hasDuplicateLabel = useCallback(
    (list, label, idToIgnore = null) => {
      const L = sanitizeLabel(label).toLowerCase();
      return list.some((t) => t.label?.trim().toLowerCase() === L && t.id !== idToIgnore);
    },
    [sanitizeLabel]
  );

  const stateCounts = useMemo(
    () => ({ articles: articleTags.length, broderies: broderieTags.length, rules: rulesCount }),
    [articleTags.length, broderieTags.length, rulesCount]
  );

  // Compteur des règles (count-only)
  const refreshRulesCount = useCallback(async () => {
    try {
      const { count, error: err } = await supabase
        .from("nettoyage_rules")
        .select("*", { count: "exact", head: true });
      if (err) throw err;
      setRulesCount(count ?? 0);
    } catch (e) {
      console.error("Erreur count nettoyage_rules:", e.message || e);
    }
  }, []);

  // Fetch tags en parallèle + compteur des règles
  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [art, bro] = await Promise.all([
        supabase.from("articleTags").select("*").order("label", { ascending: true }),
        supabase.from("broderieTags").select("*").order("label", { ascending: true }),
      ]);

      if (art.error) throw new Error(`articleTags: ${art.error.message}`);
      if (bro.error) throw new Error(`broderieTags: ${bro.error.message}`);

      setArticleTags((art.data ?? []).sort(sortByLabel));
      setBroderieTags((bro.data ?? []).sort(sortByLabel));
    } catch (e) {
      console.error(e);
      setError(e.message || "Erreur inattendue lors du chargement des tags.");
    } finally {
      setLoading(false);
    }

    // toujours rafraîchir le compteur des règles
    refreshRulesCount();
  }, [sortByLabel, refreshRulesCount]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Realtime sur nettoyage_rules pour garder le compteur à jour
  useEffect(() => {
    const ch = supabase
      .channel("realtime-nettoyage-rules")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nettoyage_rules" },
        () => refreshRulesCount()
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [refreshRulesCount]);

  // ────────────────────────────────
  // Article tags CRUD (optimistic) + cascade rules delete
  // ────────────────────────────────
  const addArticleTag = useCallback(
    async (label, nettoyage) => {
      const clean = sanitizeLabel(label);
      if (!clean) return { ok: false, reason: "Label vide" };
      if (hasDuplicateLabel(articleTags, clean)) return { ok: false, reason: "Doublon" };

      const optimistic = { id: `tmp-${Date.now()}`, label: clean, nettoyage: Number(nettoyage) || 0 };
      setArticleTags((prev) => [...prev, optimistic].sort(sortByLabel));

      const { data, error } = await supabase
        .from("articleTags")
        .insert([{ label: clean, nettoyage: optimistic.nettoyage }])
        .select()
        .single();

      if (error) {
        console.error("❌ Erreur ajout articleTag:", error.message);
        // rollback
        setArticleTags((prev) => prev.filter((t) => t.id !== optimistic.id));
        return { ok: false, reason: error.message };
      }

      // replace temp with real
      setArticleTags((prev) => prev.map((t) => (t.id === optimistic.id ? data : t)).sort(sortByLabel));
      return { ok: true };
    },
    [articleTags, hasDuplicateLabel, sanitizeLabel, sortByLabel]
  );

  const updateArticleTag = useCallback(
    async (id, label, nettoyage) => {
      const clean = sanitizeLabel(label);
      if (!clean) return { ok: false, reason: "Label vide" };
      if (hasDuplicateLabel(articleTags, clean, id)) return { ok: false, reason: "Doublon" };

      const prev = articleTags.find((t) => t.id === id);
      const patch = { label: clean, nettoyage: Number(nettoyage) || 0 };
      setArticleTags((prevList) => prevList.map((t) => (t.id === id ? { ...t, ...patch } : t)).sort(sortByLabel));

      const { error } = await supabase.from("articleTags").update(patch).eq("id", id);
      if (error) {
        console.error("❌ Erreur MAJ articleTag:", error.message);
        // rollback
        setArticleTags((prevList) => prevList.map((t) => (t.id === id ? prev : t)).sort(sortByLabel));
        return { ok: false, reason: error.message };
      }
      return { ok: true };
    },
    [articleTags, hasDuplicateLabel, sanitizeLabel, sortByLabel]
  );

  const deleteArticleTag = useCallback(
    async (id) => {
      // snapshot pour rollback
      const snapshot = articleTags;
      const tag = snapshot.find((t) => t.id === id);
      if (!tag) return { ok: false, reason: "Introuvable" };

      // Supprime TOUTES les variantes de casse de ce label (Ceinture/ceinture/CEINTURE…)
      const norm = normalize(tag.label);
      const toRemove = snapshot.filter((t) => normalize(t.label) === norm);
      const toRemoveIds = toRemove.map((t) => t.id);

      // Optimistic UI
      setArticleTags((list) => list.filter((t) => !toRemoveIds.includes(t.id)));

      // Suppression DB (toutes les variantes)
      const { error } = await supabase.from("articleTags").delete().in("id", toRemoveIds);

      if (error) {
        console.error("❌ Erreur suppression articleTag:", error.message);
        // rollback
        setArticleTags(snapshot);
        alert("Suppression refusée : " + error.message);
        return { ok: false, reason: error.message };
      }

      // Best-effort : supprimer aussi les règles associées à l’article
      try {
        await supabase
          .from("nettoyage_rules")
          .delete()
          .ilike("article_label", tag.label); // supprime les règles qui matchent (insensible à la casse via ILIKE)
      } catch (e) {
        console.warn("⚠️ Règles non supprimées (non bloquant) :", e?.message);
      }

      // Re-sync dur avec le serveur (évite les incohérences)
      await fetchTags();
      return { ok: true };
    },
    [articleTags, fetchTags, normalize]
  );

  // ────────────────────────────────
  // Broderie tags CRUD (optimistic) + cascade rules delete
  // ────────────────────────────────
  const addBroderieTag = useCallback(
    async (label) => {
      const clean = sanitizeLabel(label);
      if (!clean) return { ok: false, reason: "Label vide" };
      if (hasDuplicateLabel(broderieTags, clean)) return { ok: false, reason: "Doublon" };

      const optimistic = { id: `tmp-${Date.now()}`, label: clean };
      setBroderieTags((prev) => [...prev, optimistic].sort(sortByLabel));

      const { data, error } = await supabase.from("broderieTags").insert([{ label: clean }]).select().single();

      if (error) {
        console.error("❌ Erreur ajout broderieTag:", error.message);
        setBroderieTags((prev) => prev.filter((t) => t.id !== optimistic.id));
        return { ok: false, reason: error.message };
      }

      setBroderieTags((prev) => prev.map((t) => (t.id === optimistic.id ? data : t)).sort(sortByLabel));
      return { ok: true };
    },
    [broderieTags, hasDuplicateLabel, sanitizeLabel, sortByLabel]
  );

  const updateBroderieTag = useCallback(
    async (id, label) => {
      const clean = sanitizeLabel(label);
      if (!clean) return { ok: false, reason: "Label vide" };
      if (hasDuplicateLabel(broderieTags, clean, id)) return { ok: false, reason: "Doublon" };

      const prev = broderieTags.find((t) => t.id === id);
      setBroderieTags((prevList) =>
        prevList.map((t) => (t.id === id ? { ...t, label: clean } : t)).sort(sortByLabel)
      );

      const { error } = await supabase.from("broderieTags").update({ label: clean }).eq("id", id);
      if (error) {
        console.error("❌ Erreur MAJ broderieTag:", error.message);
        setBroderieTags((prevList) => prevList.map((t) => (t.id === id ? prev : t)).sort(sortByLabel));
        return { ok: false, reason: error.message };
      }
      return { ok: true };
    },
    [broderieTags, hasDuplicateLabel, sanitizeLabel, sortByLabel]
  );

  const deleteBroderieTag = useCallback(
    async (id) => {
      const prev = broderieTags;
      const tag = prev.find((t) => t.id === id);
      if (!tag) return { ok: false, reason: "Introuvable" };

      let cascade = false;
      if (
        window.confirm(
          `Supprimer la broderie "${tag.label}" ?\n\nAstuce : cliquez sur "OK" pour supprimer aussi toutes les règles de nettoyage liées à cette zone. Cliquez sur "Annuler" pour ne supprimer que le tag.`
        )
      ) {
        cascade = true;
      }

      // optimistic removal du tag
      setBroderieTags((list) => list.filter((t) => t.id !== id));

      try {
        if (cascade) {
          const { error: errRules } = await supabase
            .from("nettoyage_rules")
            .delete()
            .ilike("broderie_label", tag.label);
          if (errRules) throw errRules;
          refreshRulesCount();
        }

        const { error } = await supabase.from("broderieTags").delete().eq("id", id);
        if (error) throw error;

        return { ok: true };
      } catch (e) {
        console.error("❌ Erreur suppression broderieTag:", e.message || e);
        // rollback
        setBroderieTags(prev);
        return { ok: false, reason: e.message || "Erreur suppression" };
      }
    },
    [broderieTags, refreshRulesCount]
  );

  // ────────────────────────────────
  // UI
  // ────────────────────────────────
  return (
    <div className="parametres-page">
      <header className="parametres-header">
        <h2>Réglage Etiquettes & Nettoyage</h2>
        <div className="parametres-counters">
          <span>Articles: {stateCounts.articles}</span>
          <span>Broderie: {stateCounts.broderies}</span>
          <span>Règles nettoyage: {stateCounts.rules}</span>
        </div>
      </header>

      {error && (
        <div className="parametres-alert" role="alert" aria-live="assertive">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="parametres-loading" aria-busy="true">Chargement des tags…</div>
      ) : (
        <>
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

          {/* Éditeur des règles de nettoyage */}
          <section className="nettoyage-section">
            <h3>Règles de nettoyage par article & zone</h3>
            <p className="muted">
              Associez des <strong>zones réalisables</strong> pour chaque article, et indiquez le <strong>temps de
              nettoyage</strong> (en secondes). Ces règles seront utilisées pour le calcul précis dans la création/simulation de commandes.
            </p>

            <NettoyageRulesEditor
              articleTags={articleTags}
              broderieTags={broderieTags}
              onMutate={refreshRulesCount}
            />
          </section>
        </>
      )}
    </div>
  );
}
