import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Banner from "./components/layout/Banner";
import AdminNavbar from "./components/layout/AdminNavbar/AdminNavbar";
import OperateurNavbar from "./components/layout/OperateurNavbar/OperateurNavbar";
import CommandesAdmin from "./Pages/Admin/CommandesAdmin/Commandes";
import Machines from "./Pages/Admin/Machines/Machines";
import Operateur from "./Pages/Admin/Operateur/Operateur";
import Planning from "./Pages/Admin/Planning/Planning";
import Parametres from "./Pages/Admin/Parametres/Parametres";
import CommandesOperateur from "./Pages/CommandesOperateur/CommandesOperateur";
import Home from "./Home/Home";
import { EtiquettesProvider } from "./context/EtiquettesContext";

function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isOperateur = location.pathname.startsWith("/operateur");

  return (
    <div className="App">
      <Banner />
      {isAdmin && <AdminNavbar />}
      {isOperateur && <OperateurNavbar />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/commandes" element={<CommandesAdmin />} />
        <Route path="/admin/machines" element={<Machines />} />
        <Route path="/admin/operateur" element={<Operateur />} />
        <Route path="/admin/planning" element={<Planning />} />
        <Route path="/admin/parametres" element={<Parametres />} />
        <Route path="/operateur/commandes" element={<CommandesOperateur />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <EtiquettesProvider>
      <Router>
        <AppContent />
      </Router>
    </EtiquettesProvider>
  );
}

export default App;
