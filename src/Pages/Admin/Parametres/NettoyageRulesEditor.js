// src/Pages/Admin/Parametres/NettoyageRulesEditor.jsx
import React from "react";
import { EtiquettesContext } from "../../../context/EtiquettesContext";
import {
  fetchNettoyageRules,
  upsertNettoyageRules,
} from "../../../utils/nettoyageRules";

// --------- Helpers
function normalizeTag(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim().toLowerCase();
  if (typeof v === "object") {
    const cand = v.label ?? v.name ?? v.value ?? (typeof v.toString === "function" ? v.toString() : null);
    return cand ? String(cand).trim().toLowerCase() : "";
  }
  return String(v).trim().toLowerCase();
}
function makeKey(a, b) {
  return `${normalizeTag(a)}|${normalizeTag(b)}`;
}
function matchesQuery(label, q) {
  const L = (label ?? "").toString().toLowerCase();
  const Q = (q ?? "").toString().toLowerCase().trim();
  if (!Q) return true;
  return L.includes(Q);
}

/**
 * NettoyageRulesEditor — menu déroulant par article + double recherche
 * -------------------------------------------------------------------
 * - Recherche 1: filtre la liste des ARTICLES
 * - Recherche 2: filtre les ZONES (tags broderie) dans chaque article
 * - Éditions inline + sauvegarde en lot (dirty map)
 * - Boutons "Tout autoriser / Tout interdire" par article
 * - Conserve votre logique de contexte/props existante
 */
export default function NettoyageRulesEditor(props) {
  // Contexte + props (les props priment, sinon fallback contexte)
  const ctx = React.useContext(EtiquettesContext);
  const propArticleTags = props?.articleTags;
  const propBroderieTags = props?.broderieTags;
  const ctxArticleTags = ctx?.articleTags;
  const ctxBroderieTags = ctx?.broderieTags;
  const onMutate = props?.onMutate;

  // useMemo stabilisés
  const articleTags = React.useMemo(() => {
    if (Array.isArray(propArticleTags)) return propArticleTags;
    if (Array.isArray(ctxArticleTags)) return ctxArticleTags;
    return [];
  }, [propArticleTags, ctxArticleTags]);

  const broderieTags = React.useMemo(() => {
    if (Array.isArray(propBroderieTags)) return propBroderieTags;
    if (Array.isArray(ctxBroderieTags)) return ctxBroderieTags;
    return [];
  }, [propBroderieTags, ctxBroderieTags]);

  const [rules, setRules] = React.useState([]);
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  // Map<"article|broderie", row modifiée>
  const [dirty, setDirty] = React.useState(new Map());
  const [openArticles, setOpenArticles] = React.useState(() => new Set());

  // NEW — double recherche
  const [articleQuery, setArticleQuery] = React.useState("");
  const [zoneQuery, setZoneQuery] = React.useState("");

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchNettoyageRules();
      setRules(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Erreur lors du chargement des règles de nettoyage.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  // Index rapide des règles existantes
  const index = React.useMemo(() => {
    const m = new Map(); // key "article|broderie" -> row
    for (const r of rules) {
      m.set(makeKey(r.article_label, r.broderie_label), r);
    }
    return m;
  }, [rules]);

  // Récupère la ligne existante ou brouillon
  const getRow = React.useCallback(
    (articleLabel, broderieLabel) => {
      return (
        index.get(makeKey(articleLabel, broderieLabel)) ?? {
          article_label: articleLabel,
          broderie_label: broderieLabel,
          nettoyage_sec: 0,
          is_allowed: false,
        }
      );
    },
    [index]
  );

  // Met à jour une ligne (en mémoire) et marque comme dirty
  const setRow = React.useCallback((row) => {
    setRules((prev) => {
      const next = [...prev];
      const i = next.findIndex(
        (x) =>
          normalizeTag(x.article_label) === normalizeTag(row.article_label) &&
          normalizeTag(x.broderie_label) === normalizeTag(row.broderie_label)
      );

    if (i >= 0) next[i] = row; else next.push(row);
      return next;
    });
    setDirty((prev) => {
      const next = new Map(prev);
      next.set(makeKey(row.article_label, row.broderie_label), row);
      return next;
    });
  }, []);

  // Tout autoriser/interdire pour un article donné
  const bulkToggleForArticle = React.useCallback(
    (articleLabel, allowed) => {
      const updates = broderieTags.map((b) => {
        const row = getRow(articleLabel, b.label);
        return { ...row, is_allowed: !!allowed };
      });

      setRules((prev) => {
        const byKey = new Map(prev.map((r) => [makeKey(r.article_label, r.broderie_label), r]));
        for (const r of updates) byKey.set(makeKey(r.article_label, r.broderie_label), r);
        return Array.from(byKey.values());
      });

      setDirty((prev) => {
        const next = new Map(prev);
        for (const r of updates) next.set(makeKey(r.article_label, r.broderie_label), r);
        return next;
      });
    },
    [broderieTags, getRow]
  );

  const handleSave = React.useCallback(async () => {
    if (dirty.size === 0) return;
    setSaving(true);
    try {
      await upsertNettoyageRules(Array.from(dirty.values()));
      setDirty(new Map());
      await reload(); // récupère ids/état canonique depuis la DB
      onMutate && onMutate();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'enregistrement des règles.");
    } finally {
      setSaving(false);
    }
  }, [dirty, reload, onMutate]);

  // Gestion ouverture/fermeture natif <details>
  const toggleOpen = React.useCallback((label, isOpen) => {
    setOpenArticles((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(label); else next.delete(label);
      return next;
    });
  }, []);

  // Listes filtrées selon les requêtes
  const filteredArticles = React.useMemo(() => {
    return articleTags.filter((a) => matchesQuery(a.label, articleQuery));
  }, [articleTags, articleQuery]);

  const hasArticleFilter = articleQuery.trim().length > 0;
  const hasZoneFilter = zoneQuery.trim().length > 0;

  return (
    <div>
      <h3 style={{ marginBottom: 6 }}>Temps de nettoyage par article & zone</h3>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Utilisez les champs ci-dessous pour filtrer les <strong>articles</strong> et les <strong>zones</strong> indépendamment.
      </p>

      {/* Barre de recherche double */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          type="search"
          placeholder="Rechercher un article..."
          value={articleQuery}
          onChange={(e) => setArticleQuery(e.target.value)}
          aria-label="Rechercher un article"
        />
        <input
          type="search"
          placeholder="Rechercher une zone (tag broderie)..."
          value={zoneQuery}
          onChange={(e) => setZoneQuery(e.target.value)}
          aria-label="Rechercher une zone"
        />
        <button type="button" onClick={() => { setArticleQuery(""); setZoneQuery(""); }} title="Effacer les recherches">
          Réinitialiser
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
        {hasArticleFilter && <span style={{ marginRight: 10 }}>Articles filtrés: {filteredArticles.length}/{articleTags.length}</span>}
        {hasZoneFilter && <span>Filtre zones actif</span>}
      </div>

      {error && (
        <div role="alert" style={{ color: "#b00020", margin: "8px 0" }}>⚠️ {error}</div>
      )}

      {loading ? (
        <div aria-busy="true">Chargement des règles…</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filteredArticles.map((art) => {
            const articleLabel = art.label;
            const isOpen = openArticles.has(articleLabel);
            return (
              <details
                key={articleLabel}
                open={isOpen}
                onToggle={(e) => toggleOpen(articleLabel, e.currentTarget.open)}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  background: "#fff",
                  overflow: "hidden",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    padding: "10px 12px",
                    listStyle: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    background: "#fafafa",
                    borderBottom: isOpen ? "1px solid #eee" : "none",
                  }}
                >
                  <span><strong>Article :</strong> {articleLabel}</span>
                  <span style={{ display: "inline-flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); bulkToggleForArticle(articleLabel, true); }}
                      title="Autoriser toutes les zones pour cet article"
                    >
                      Tout autoriser
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); bulkToggleForArticle(articleLabel, false); }}
                      title="Interdire toutes les zones pour cet article"
                    >
                      Tout interdire
                    </button>
                  </span>
                </summary>

                <div style={{ padding: 12, overflowX: "auto" }}>
                  <table className="table-rules" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Zone (tag broderie)</th>
                        <th style={{ textAlign: "center", width: 130 }}>Autorisé</th>
                        <th style={{ textAlign: "left", width: 240 }}>Temps nettoyage (sec)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {broderieTags
                        .filter((b) => matchesQuery(b.label, zoneQuery))
                        .map((b) => {
                          const row = getRow(articleLabel, b.label);
                          const compositeKey = row.id ?? makeKey(articleLabel, b.label);
                          return (
                            <tr key={compositeKey}>
                              <td style={{ padding: "6px 8px" }}>{b.label}</td>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={!!row.is_allowed}
                                  onChange={(e) => setRow({ ...row, is_allowed: e.target.checked })}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min={0}
                                  step={5}
                                  value={row.nettoyage_sec ?? 0}
                                  onChange={(e) => setRow({ ...row, nettoyage_sec: Math.max(0, Number(e.target.value || 0)) })}
                                  style={{ width: 120 }}
                                  disabled={!row.is_allowed}
                                  aria-label={`Temps nettoyage pour ${b.label}`}
                                />
                                <span style={{ opacity: 0.7, marginLeft: 6 }}>sec</span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={handleSave} disabled={saving || dirty.size === 0}>
          {saving ? "Enregistrement..." : `Enregistrer ${dirty.size > 0 ? `(${dirty.size})` : ""}`}
        </button>
        {dirty.size > 0 && <span style={{ opacity: 0.7 }}>Modifications en attente</span>}
      </div>
    </div>
  );
}
