import { useCallback, useEffect, useMemo, useState } from "react";
import ArticleTagsSection from "./ArticlesTagsSection";
import BroderieTagsSection from "./BroderieTagsSection";
import NettoyageRulesEditor from "./NettoyageRulesEditor";
import supabase from '@/lib/supabaseClient'
import "./Parametres.css";

/** Normalisation robuste pour comparer/assainir les labels */
function normLabel(s = "") {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // accents
    .toLowerCase()
    .replace(/\s+/g, " ")   // espaces multiples -> 1 espace
    .replace(/[-_]/g, "-")  // unifie tirets
    .trim();
}
const sanitizeLabel = (v) => String(v ?? "").trim();

/**
 * Parametres
 * — Centralise le chargement/MAJ des tags Article & Broderie
 * — Ajoute l'éditeur des règles de nettoyage (article × zone)
 * — Realtime sur tags & nettoyage_rules
 * — Suppression en cascade (optionnelle) des règles liées aux tags supprimés
 */
export default function Parametres() {
  const [articleTags, setArticleTags] = useState([]);
  const [broderieTags, setBroderieTags] = useState([]);
  const [rulesCount, setRulesCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🔒 Empêcher tout submit involontaire dans la page
  useEffect(() => {
    const onSubmit = (e) => {
      const root = document.querySelector(".parametres-page");
      if (root && root.contains(e.target)) e.preventDefault();
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  const sortByLabel = useCallback(
    (a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }),
    []
  );

  const hasDuplicateLabel = useCallback((list, label, idToIgnore = null) => {
    const L = normLabel(label);
    return list.some((t) => normLabel(t.label) === L && t.id !== idToIgnore);
  }, []);

  const stateCounts = useMemo(
    () => ({ articles: articleTags.length, broderies: broderieTags.length, rules: rulesCount }),
    [articleTags.length, broderieTags.length, rulesCount]
  );

  // ────────────────────────────────
  // Fetchers
  // ────────────────────────────────
  const refetchRulesCount = useCallback(async () => {
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

  const refetchArticleTags = useCallback(async () => {
    const res = await supabase.from("articleTags").select("*").order("label", { ascending: true });
    if (res.error) throw new Error(`articleTags: ${res.error.message}`);
    setArticleTags((res.data ?? []).sort(sortByLabel));
  }, [sortByLabel]);

  const refetchBroderieTags = useCallback(async () => {
    const res = await supabase.from("broderieTags").select("*").order("label", { ascending: true });
    if (res.error) throw new Error(`broderieTags: ${res.error.message}`);
    setBroderieTags((res.data ?? []).sort(sortByLabel));
  }, [sortByLabel]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([refetchArticleTags(), refetchBroderieTags(), refetchRulesCount()]);
    } catch (e) {
      console.error(e);
      setError(e.message || "Erreur inattendue lors du chargement des paramètres.");
    } finally {
      setLoading(false);
    }
  }, [refetchArticleTags, refetchBroderieTags, refetchRulesCount]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ────────────────────────────────
  // Realtime sur tags & règles
  // ────────────────────────────────
  useEffect(() => {
    const chA = supabase
      .channel("rt-article-tags")
      .on("postgres_changes", { event: "*", schema: "public", table: "articleTags" }, () => refetchArticleTags())
      .subscribe();

    const chB = supabase
      .channel("rt-broderie-tags")
      .on("postgres_changes", { event: "*", schema: "public", table: "broderieTags" }, () => refetchBroderieTags())
      .subscribe();

    const chR = supabase
      .channel("rt-nettoyage-rules")
      .on("postgres_changes", { event: "*", schema: "public", table: "nettoyage_rules" }, () => refetchRulesCount())
      .subscribe();

    return () => {
      supabase.removeChannel(chA);
      supabase.removeChannel(chB);
      supabase.removeChannel(chR);
    };
  }, [refetchArticleTags, refetchBroderieTags, refetchRulesCount]);

  // ────────────────────────────────
  // CRUD Article tags (optimistic)
  // ────────────────────────────────
  const addArticleTag = useCallback(
    async (label) => {
      const clean = sanitizeLabel(label);
      if (!clean) return { ok: false, reason: "Label vide" };
      if (hasDuplicateLabel(articleTags, clean)) return { ok: false, reason: "Doublon" };

      // UI optimiste
      const optimistic = { id: `tmp-${Date.now()}`, label: clean };
      setArticleTags((prev) => [...prev, optimistic].sort(sortByLabel));

      // Insert
      const { data, error } = await supabase.from("articleTags").insert([{ label: clean }]).select().single();

      if (error) {
        console.error("❌ Erreur ajout articleTag:", error.message);
        // rollback
        setArticleTags((prev) => prev.filter((t) => t.id !== optimistic.id));
        return { ok: false, reason: error.message };
      }

      // remplace le temp par la vraie ligne
      setArticleTags((prev) => prev.map((t) => (t.id === optimistic.id ? data : t)).sort(sortByLabel));
      return { ok: true };
    },
    [articleTags, hasDuplicateLabel, sortByLabel]
  );

  const updateArticleTag = useCallback(
    async (id, label) => {
      const clean = sanitizeLabel(label);
      if (!clean) return { ok: false, reason: "Label vide" };
      if (hasDuplicateLabel(articleTags, clean, id)) return { ok: false, reason: "Doublon" };

      const prevRow = articleTags.find((t) => t.id === id);
      const patch = { label: clean };

      // Optimistic
      setArticleTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)).sort(sortByLabel));

      const { error } = await supabase.from("articleTags").update(patch).eq("id", id);
      if (error) {
        console.error("❌ Erreur MAJ articleTag:", error.message);
        // rollback
        setArticleTags((prev) => prev.map((t) => (t.id === id ? prevRow : t)).sort(sortByLabel));
        return { ok: false, reason: error.message };
      }
      return { ok: true };
    },
    [articleTags, hasDuplicateLabel, sortByLabel]
  );

  const deleteArticleTag = useCallback(
    async (id) => {
      const snapshot = articleTags;
      const tag = snapshot.find((t) => t.id === id);
      if (!tag) return { ok: false, reason: "Introuvable" };

      // Option : supprimer toutes les variantes de casse du même label
      const targetNorm = normLabel(tag.label);
      const toRemoveIds = snapshot.filter((t) => normLabel(t.label) === targetNorm).map((t) => t.id);

      // Optimistic removal
      setArticleTags((list) => list.filter((t) => !toRemoveIds.includes(t.id)));

      try {
        // 1) Cascade côté règles (compat : par label si pas d'ID)
        await supabase.from("nettoyage_rules").delete().ilike("article_label", tag.label);
        await supabase.from("nettoyage_rules").delete().in("article_id", toRemoveIds).catch(() => null);
        await refetchRulesCount();

        // 2) Supprimer les tags
        const { error } = await supabase.from("articleTags").delete().in("id", toRemoveIds);
        if (error) throw error;

        return { ok: true };
      } catch (e) {
        console.error("[DELETE articleTags] failed:", e);
        setArticleTags(snapshot); // rollback visuel
        setError(e?.message ?? "Suppression échouée");
        return { ok: false, reason: e?.message ?? "Suppression échouée" };
      }
    },
    [articleTags, refetchRulesCount]
  );

  // ────────────────────────────────
  // CRUD Broderie tags (optimistic)
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
    [broderieTags, hasDuplicateLabel, sortByLabel]
  );

  const updateBroderieTag = useCallback(
    async (id, label) => {
      const clean = sanitizeLabel(label);
      if (!clean) return { ok: false, reason: "Label vide" };
      if (hasDuplicateLabel(broderieTags, clean, id)) return { ok: false, reason: "Doublon" };

      const prevRow = broderieTags.find((t) => t.id === id);

      setBroderieTags((prev) => prev.map((t) => (t.id === id ? { ...t, label: clean } : t)).sort(sortByLabel));

      const { error } = await supabase.from("broderieTags").update({ label: clean }).eq("id", id);
      if (error) {
        console.error("❌ Erreur MAJ broderieTag:", error.message);
        setBroderieTags((prev) => prev.map((t) => (t.id === id ? prevRow : t)).sort(sortByLabel));
        return { ok: false, reason: error.message };
      }
      return { ok: true };
    },
    [broderieTags, hasDuplicateLabel, sortByLabel]
  );

  const deleteBroderieTag = useCallback(
    async (id) => {
      const snapshot = broderieTags;
      const tag = snapshot.find((t) => t.id === id);
      if (!tag) return { ok: false, reason: "Introuvable" };

      const cascade = window.confirm(
        `Supprimer la zone de broderie "${tag.label}" ?\n\nOK = supprimer aussi toutes les règles liées.\nAnnuler = supprimer uniquement le tag.`
      );

      // Optimistic removal
      setBroderieTags((list) => list.filter((t) => t.id !== id));

      try {
        if (cascade) {
          await supabase.from("nettoyage_rules").delete().ilike("broderie_label", tag.label);
          await supabase.from("nettoyage_rules").delete().eq("broderie_id", id).catch(() => null);
          await refetchRulesCount();
        }

        const { error } = await supabase.from("broderieTags").delete().eq("id", id);
        if (error) throw error;

        return { ok: true };
      } catch (e) {
        console.error("❌ Erreur suppression broderieTag:", e.message || e);
        setBroderieTags(snapshot); // rollback
        return { ok: false, reason: e.message || "Erreur suppression" };
      }
    },
    [broderieTags, refetchRulesCount]
  );

  // ────────────────────────────────
  // UI
  // ────────────────────────────────
  return (
    <div className="parametres-page">
      <header className="parametres-header">
        <h2>Réglage Étiquettes & Nettoyage</h2>
        <div className="parametres-counters">
          <span>Articles : {stateCounts.articles}</span>
          <span>Broderie : {stateCounts.broderies}</span>
          <span>Règles nettoyage : {stateCounts.rules}</span>
        </div>
      </header>

      {error && (
        <div className="parametres-alert" role="alert" aria-live="assertive">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="parametres-loading" aria-busy="true">Chargement des paramètres…</div>
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

          <section className="nettoyage-section">
            <h3>Règles de nettoyage par article & zone</h3>
            <p className="muted">
              Associez les <strong>zones réalisables</strong> pour chaque article, et indiquez le
              <strong> temps de nettoyage</strong> (en secondes). Ces règles servent au calcul temps & faisabilité.
            </p>

            {/* On garde l'API existante du composant */}
            <NettoyageRulesEditor
              articleTags={articleTags}
              broderieTags={broderieTags}
              onMutate={refetchRulesCount}
            />
          </section>
        </>
      )}
    </div>
  );
}
