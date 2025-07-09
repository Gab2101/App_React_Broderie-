import React from "react";
import { Link } from "react-router-dom";
import "./Home.css";

function Home() {
  return (
    <div className="home-page">
      <h1>Bienvenue sur l'application de broderie</h1>
      <div className="home-buttons">
        <Link to="/admin/commandes" className="home-link">Accès Administrateur</Link>
        <Link to="/operateur/commandes" className="home-link">Accès Opérateur</Link>
      </div>
    </div>
  );
}

export default Home;
