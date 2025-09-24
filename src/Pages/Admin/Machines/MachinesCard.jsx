// src/pages/Machines/MachinesCard.js
import React, { useMemo } from "react";
import PropTypes from "prop-types";
import "./MachinesCard.css";

function MachinesCard({ machine, onClick, articleTags = [], broderieTags = [] }) {
  const etiquettes = useMemo(() => {
    const raw = machine?.etiquettes;
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === "string") {
      try {
        const j = JSON.parse(raw);
        return Array.isArray(j) ? j.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [machine]);

  const norm = (s) => String(s ?? "").trim().toLowerCase();

  const articleSet = useMemo(
    () => new Set((articleTags || []).map((a) => norm(a?.label))),
    [articleTags]
  );
  const broderieSet = useMemo(
    () => new Set((broderieTags || []).map((b) => norm(b?.label))),
    [broderieTags]
  );

  const { articleList, broderieList } = useMemo(() => {
    const art = [];
    const brd = [];
    for (const t of etiquettes) {
      const n = norm(t);
      if (articleSet.has(n)) art.push(t);
      else if (broderieSet.has(n)) brd.push(t);
    }
    return { articleList: art, broderieList: brd };
  }, [etiquettes, articleSet, broderieSet]);

  const showFallback =
    etiquettes.length > 0 && articleList.length === 0 && broderieList.length === 0;

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(machine);
    }
  };

  // Empêche l’ouverture de la modale quand on clique dans les menus déroulants
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="machine-card"
      onClick={() => onClick?.(machine)}
      role="button"
      tabIndex={0}
      onKeyDown={handleKey}
      aria-label={`Machine ${machine?.nom ?? ""}`}
    >
      <h3>{machine?.nom ?? "Sans nom"}</h3>
      <p>
        <strong>Têtes :</strong> {machine?.nbTetes ?? <em>—</em>}
      </p>

      {articleList.length > 0 && (
        <details className="dropdown" open onClick={stop} onKeyDown={stop}>
          <summary><strong>Articles</strong></summary>
          <div className="tag-list" onClick={stop} onKeyDown={stop}>
            {articleList.map((t, i) => (
              <span key={`art-${i}`} className="tag readonly">{t}</span>
            ))}
          </div>
        </details>
      )}

      {broderieList.length > 0 && (
        <details className="dropdown" onClick={stop} onKeyDown={stop}>
          <summary><strong>Options de broderie</strong></summary>
          <div className="tag-list" onClick={stop} onKeyDown={stop}>
            {broderieList.map((t, i) => (
              <span key={`brd-${i}`} className="tag readonly">{t}</span>
            ))}
          </div>
        </details>
      )}

      {showFallback && (
        <div className="tag-group">
          <p><strong>Étiquettes :</strong></p>
          <div className="tag-list">
            {etiquettes.map((t, i) => (
              <span key={`all-${i}`} className="tag readonly">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

MachinesCard.propTypes = {
  machine: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    nom: PropTypes.string,
    nbTetes: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    etiquettes: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  }).isRequired,
  onClick: PropTypes.func,
  articleTags: PropTypes.array,
  broderieTags: PropTypes.array,
};

export default React.memo(MachinesCard);
