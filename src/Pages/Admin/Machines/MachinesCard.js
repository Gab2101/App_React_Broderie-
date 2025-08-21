import React from "react";
import "./MachinesCard.css";

function MachineCard({ machine, onClick, articleTags = [], broderieTags = [] }) {
  // 1) Sécurise/parse les étiquettes
  let etiquettes = [];
  if (Array.isArray(machine?.etiquettes)) {
    etiquettes = machine.etiquettes;
  } else if (typeof machine?.etiquettes === "string") {
    try {
      etiquettes = JSON.parse(machine.etiquettes);
    } catch {
      etiquettes = [];
    }
  }

  // 2) Normalisation pour comparer (trim + lowerCase)
  const norm = (s) => String(s ?? "").trim().toLowerCase();

  // 3) Listes de référence normalisées
  const articleSet = new Set(articleTags.map((a) => norm(a.label)));
  const broderieSet = new Set(broderieTags.map((b) => norm(b.label)));

  // 4) Séparation
  const articleList = etiquettes.filter((t) => articleSet.has(norm(t)));
  const broderieList = etiquettes.filter((t) => broderieSet.has(norm(t)));

  // 5) Fallback: si on a des étiquettes mais rien ne “matche”
  const showFallback = etiquettes.length > 0 && articleList.length === 0 && broderieList.length === 0;

  // 6) DEBUG minimal (tu peux commenter après vérif)
  // console.log("[Card]", { machine, etiquettes, articleTags, broderieTags, articleList, broderieList });

  return (
    <div className="machine-card" onClick={() => onClick?.(machine)}>
      <h3>{machine?.nom ?? "Sans nom"}</h3>
      <p><strong>Têtes :</strong> {machine?.nbTetes ?? "?"}</p>

      {/* Articles */}
      {articleList.length > 0 && (
        <div className="tag-group">
          <p><strong>Articles :</strong></p>
          <div className="tag-list">
            {articleList.map((t, i) => (
              <span key={i} className="tag readonly">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Options de broderie */}
      {broderieList.length > 0 && (
        <div className="tag-group">
          <p><strong>Options de broderie :</strong></p>
          <div className="tag-list">
            {broderieList.map((t, i) => (
              <span key={i} className="tag readonly">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Fallback: affiche tout si rien ne matche */}
      {showFallback && (
        <div className="tag-group">
          <p><strong>Étiquettes :</strong></p>
          <div className="tag-list">
            {etiquettes.map((t, i) => (
              <span key={i} className="tag readonly">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MachineCard;
