import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import "../Navbar.css";

function AdminNavbar() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <ul className="navbar__list">
        <li className="navbar__item">
          <NavLink
            to="/admin/commandes"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'is-active' : ''}`
            }
          >
            <span className="navbar__label">Commandes</span>
          </NavLink>
        </li>
        <li className="navbar__item">
          <NavLink
            to="/admin/machines"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'is-active' : ''}`
            }
          >
            <span className="navbar__label">Machines</span>
          </NavLink>
        </li>
        <li className="navbar__item">
          <NavLink
            to="/admin/planning"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'is-active' : ''}`
            }
          >
            <span className="navbar__label">Planning</span>
          </NavLink>
        </li>
        <li className="navbar__item">
          <NavLink
            to="/admin/parametres"
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'is-active' : ''}`
            }
          >
            <span className="navbar__label">Paramètres</span>
          </NavLink>
        </li>
      </ul>
      <div className="navbar-user">
        <span className="user-info">
          <span className="user-greeting">Bonjour,</span>
          <span className="user-name">{user?.username}</span>
        </span>
        <button onClick={handleLogout} className="logout-button">
          <span>Déconnexion</span>
        </button>
      </div>
    </nav>
  );
}

export default AdminNavbar;
