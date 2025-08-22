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

  const showFallback = etiquettes.length > 0 && articleList.length === 0 && broderieList.length === 0;

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(machine);
    }
  };

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
        <div className="tag-group">
          <p><strong>Articles :</strong></p>
          <div className="tag-list">
            {articleList.map((t, i) => (
              <span key={`art-${i}`} className="tag readonly">{t}</span>
            ))}
          </div>
        </div>
      )}

      {broderieList.length > 0 && (
        <div className="tag-group">
          <p><strong>Options de broderie :</strong></p>
          <div className="tag-list">
            {broderieList.map((t, i) => (
              <span key={`brd-${i}`} className="tag readonly">{t}</span>
            ))}
          </div>
        </div>
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
