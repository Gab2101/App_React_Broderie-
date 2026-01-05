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
      <div className="navbar-links">
        <NavLink to="/admin/commandes">Commandes</NavLink>
        <NavLink to="/admin/machines">Machines</NavLink>
        <NavLink to="/admin/planning">Planning</NavLink>
        <NavLink to="/admin/parametres">Paramètres</NavLink>
      </div>
      <div className="navbar-user">
        <span className="user-email">{user?.username}</span>
        <button onClick={handleLogout} className="logout-button">
          Déconnexion
        </button>
      </div>
    </nav>
  );
}

export default AdminNavbar;
