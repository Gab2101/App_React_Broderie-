import React, { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";

export default function NettoyageRulesEditor({ articleTags, broderieTags, onMutate }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newRule, setNewRule] = useState({
    article_id: "",
    broderie_id: "",
    nettoyage_time: 0
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from("nettoyage_rules")
        .select("*")
        .order("article_id", { ascending: true });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error("Erreur chargement règles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.article_id || !newRule.broderie_id || newRule.nettoyage_time < 0) {
      alert("Veuillez remplir tous les champs correctement");
      return;
    }

    try {
      const { error } = await supabase
        .from("nettoyage_rules")
        .insert([newRule]);

      if (error) throw error;

      setNewRule({ article_id: "", broderie_id: "", nettoyage_time: 0 });
      fetchRules();
      onMutate?.();
    } catch (error) {
      console.error("Erreur ajout règle:", error);
      alert("Erreur lors de l'ajout de la règle");
    }
  };

  const handleDeleteRule = async (id) => {
    if (!confirm("Supprimer cette règle de nettoyage ?")) return;

    try {
      const { error } = await supabase
        .from("nettoyage_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;

      fetchRules();
      onMutate?.();
    } catch (error) {
      console.error("Erreur suppression règle:", error);
      alert("Erreur lors de la suppression");
    }
  };

  const getArticleLabel = (id) => {
    const tag = articleTags.find(t => t.id === id);
    return tag ? tag.label : `Article ${id}`;
  };

  const getBroderieLabel = (id) => {
    const tag = broderieTags.find(t => t.id === id);
    return tag ? tag.label : `Broderie ${id}`;
  };

  if (loading) {
    return <div>Chargement des règles...</div>;
  }

  return (
    <div className="nettoyage-rules-editor">
      <h4>Règles de nettoyage</h4>

      {/* Formulaire ajout */}
      <div className="add-rule-form" style={{ marginBottom: 20, padding: 15, border: "1px solid #ddd", borderRadius: 8 }}>
        <h5>Ajouter une règle</h5>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr auto" }}>
          <select
            value={newRule.article_id}
            onChange={(e) => setNewRule(prev => ({ ...prev, article_id: e.target.value }))}
          >
            <option value="">-- Sélectionner article --</option>
            {articleTags.map(tag => (
              <option key={tag.id} value={tag.id}>{tag.label}</option>
            ))}
          </select>

          <select
            value={newRule.broderie_id}
            onChange={(e) => setNewRule(prev => ({ ...prev, broderie_id: e.target.value }))}
          >
            <option value="">-- Sélectionner zone --</option>
            {broderieTags.map(tag => (
              <option key={tag.id} value={tag.id}>{tag.label}</option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <input
              type="number"
              min="0"
              step="1"
              value={newRule.nettoyage_time}
              onChange={(e) => setNewRule(prev => ({ ...prev, nettoyage_time: parseInt(e.target.value) || 0 }))}
              placeholder="Temps (min)"
              style={{ width: 100 }}
            />
            <button onClick={handleAddRule}>Ajouter</button>
          </div>
        </div>
      </div>

      {/* Liste des règles */}
      <div className="rules-list">
        <h5>Règles existantes</h5>
        {rules.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>Aucune règle définie</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {rules.map(rule => (
              <div key={rule.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10, border: "1px solid #eee", borderRadius: 4 }}>
                <div>
                  <strong>{getArticleLabel(rule.article_id)}</strong> → <strong>{getBroderieLabel(rule.broderie_id)}</strong>
                  <span style={{ marginLeft: 10, color: "#666" }}>
                    {rule.nettoyage_time} minute{rule.nettoyage_time !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  style={{ backgroundColor: "#dc3545", color: "white", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer" }}
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
