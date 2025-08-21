import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Banner from "./components/layout/Banner";
import AdminNavbar from "./components/layout/AdminNavbar/AdminNavbar";
import CommandesAdmin from "./Pages/Admin/Commandes/Commandes";
import Machines from "./Pages/Admin/Machines/Machines";
import Planning from "./Pages/Admin/Planning/Planning";
import Parametres from "./Pages/Admin/Parametres/Parametres";
import { EtiquettesProvider } from "./context/EtiquettesContext";

function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div className="App">
      <Banner />
      {isAdmin && <AdminNavbar />}

      <Routes>
        <Route path="/" element={<Navigate to="/admin/commandes" replace />} />
        <Route path="/admin/commandes" element={<CommandesAdmin />} />
        <Route path="/admin/machines" element={<Machines />} />
        <Route path="/admin/planning" element={<Planning />} />
        <Route path="/admin/parametres" element={<Parametres />} />
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
