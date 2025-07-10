import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/admin/commandes">Commandes</NavLink>
      <NavLink to="/admin/machines">Machines</NavLink>
      <NavLink to="/admin/planning">Planning</NavLink>
      <NavLink to="/admin/parametres">Paramètres</NavLink>
    </nav>
  );
}

export default Navbar;
