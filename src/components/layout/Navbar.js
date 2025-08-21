import React from "react";
import { NavLink } from "react-router-dom";
import "./Navbar.css";

/**
 * Navbar – rétro‑compatible.
 * Props:
 * - items?: { to: string; label: string; end?: boolean }[]
 * - sticky?: boolean        // fixe en haut
 * - align?: "center"|"left" // alignement des onglets (default "center")
 * - className?: string
 */
export default function Navbar({
  items = [
    { to: "/admin/commandes", label: "Commandes" },
    { to: "/admin/machines", label: "Machines" },
    { to: "/admin/planning", label: "Planning" },
    { to: "/admin/parametres", label: "Réglage Etiquettes" },
  ],
  sticky = false,
  align = "center",
  className = "",
}) {
  return (
    <nav
      className={[
        "navbar",
        `navbar--${align}`,
        sticky ? "navbar--sticky" : "",
        className,
      ].join(" ")}
      role="navigation"
      aria-label="Navigation principale"
    >
      <ul className="navbar__list">
        {items.map(({ to, label, end }, i) => (
          <li key={to} className="navbar__item">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                ["navbar__link", isActive ? "is-active" : ""].join(" ")
              }
            >
              <span className="navbar__label">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
