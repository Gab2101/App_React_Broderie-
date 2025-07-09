import React from "react";
import { NavLink } from "react-router-dom";
import "../Navbar.css";

function OperateurNavbar() {
  return (
    <nav className="navbar">
      <NavLink to="/operateur/commandes">Commandes</NavLink>
    </nav>
  );
}

export default OperateurNavbar;
