import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Banner from "./components/layout/Banner.jsx";
import AdminNavbar from "./components/layout/AdminNavbar/AdminNavbar";
import Navbar from "./components/layout/Navbar.jsx";
import Machines from "./Pages/Admin/Machines/Machines.jsx";
import PlanningPage from "./Pages/Admin/Planning/PlanningPage.jsx";
import Parametres from "./Pages/Admin/Parametres/Parametres";
import { EtiquettesProvider } from "./context/EtiquettesContext.jsx";
import CommandesPage from "./Pages/Admin/Commandes/CommandesPage.jsx";
import { ToastProvider } from "./components/common/Toast";
import ErrorBoundary from "./components/common/ErrorBoundary";

function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  return (
    <div className="App">
      <Banner />
      {isAdmin && <AdminNavbar />}

      <Routes>
        <Route path="/" element={<Navigate to="/admin/commandes" replace />} />
        <Route path="/admin/Commandes" element={<CommandesPage />} />
        <Route path="/admin/Machines" element={<Machines />} />
        <Route path="/admin/Planning" element={<PlanningPage />} />
        <Route path="/admin/Parametres" element={<Parametres />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <EtiquettesProvider>
          <Router>
            <AppContent />
          </Router>
        </EtiquettesProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
