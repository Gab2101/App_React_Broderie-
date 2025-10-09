import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Banner from "./components/layout/Banner.jsx";
import AdminNavbar from "./components/layout/AdminNavbar/AdminNavbar.jsx";
import Machines from "./Pages/Admin/Machines/Machines.jsx";
import PlanningPage from "./Pages/Admin/Planning/PlanningPage.jsx";
import Parametres from "./Pages/Admin/Parametres/Parametres.jsx";
import { EtiquettesProvider } from "./context/EtiquettesContext.jsx";
import CommandesPage from "./Pages/Admin/Commandes/CommandesPage.jsx";
import { ToastProvider } from "./components/common/Toast.jsx";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";
import Diagnostics from "./components/common/Diagnostics.jsx";
import { initMonitoring } from "./utils/errorHandler.js";

// Initialize production monitoring
if (import.meta.env.PROD) {
  initMonitoring();
}

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

      <Diagnostics />
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
