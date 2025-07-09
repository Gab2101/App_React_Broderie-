import React, { useEffect, useState } from "react";
import "../../styles/Commandes.css";

function CommandesOperateur() {
  const [commandes, setCommandes] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3001/commandes")
      .then((res) => res.json())
      .then((data) => setCommandes(data))
      .catch((err) => console.error("Erreur chargement commandes:", err));
  }, []);

  return (
    <div className="commandes-page">
      <h2>Commandes en cours</h2>
      <div className="liste-commandes">
        {commandes.map((cmd) => (
          <div key={cmd.id} className="carte-commande">
            <h3>Commande #{cmd.numero}</h3>
            <p><strong>Client :</strong> {cmd.client}</p>
            <p><strong>Article :</strong> {cmd.article}</p>
            <p><strong>Points :</strong> {cmd.points}</p>

            {cmd.types?.length > 0 && (
              <>
                <p><strong>Type d'article :</strong></p>
                <div className="tag-list">
                  {cmd.types.map((t, i) => (
                    <span key={i} className="tag readonly">{t}</span>
                  ))}
                </div>
              </>
            )}

            {cmd.options?.length > 0 && (
              <>
                <p><strong>Options de broderie :</strong></p>
                <div className="tag-list">
                  {cmd.options.map((t, i) => (
                    <span key={i} className="tag readonly">{t}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CommandesOperateur;
