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
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import LoginPage from "./Pages/Auth/LoginPage.jsx";

// Initialize production monitoring
if (import.meta.env.PROD) {
  initMonitoring();
}

function AppContent() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const isAdmin = location.pathname.startsWith("/admin");

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Chargement de l'application...
      </div>
    );
  }

  return (
    <div className="App">
      {user && <Banner />}
      {user && isAdmin && <AdminNavbar />}

      <Routes>
        <Route
          path="/"
          element={
            user ? <Navigate to="/admin/commandes" replace /> : <Navigate to="/login" replace />
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin/commandes"
          element={
            <ProtectedRoute>
              <CommandesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/machines"
          element={
            <ProtectedRoute>
              <Machines />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/planning"
          element={
            <ProtectedRoute>
              <PlanningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/parametres"
          element={
            <ProtectedRoute>
              <Parametres />
            </ProtectedRoute>
          }
        />
        {/* Backward compatibility for old route */}
        <Route path="/admin/Commandes" element={<Navigate to="/admin/commandes" replace />} />
        <Route path="/admin/Machines" element={<Navigate to="/admin/machines" replace />} />
        <Route path="/admin/Planning" element={<Navigate to="/admin/planning" replace />} />
        <Route path="/admin/Parametres" element={<Navigate to="/admin/parametres" replace />} />
      </Routes>

      {user && <Diagnostics />}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <EtiquettesProvider>
            <Router>
              <AppContent />
            </Router>
          </EtiquettesProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
