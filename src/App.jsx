/**
 * App.jsx — top-level router.
 * Employee Portal at "/*", Admin Portal at "/admin/*" (guarded), plus the
 * password-reset landing. Routes are code-split (React.lazy) to keep the
 * initial bundle small, and the whole tree is wrapped in an ErrorBoundary.
 */
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppDataProvider } from "./data/AppDataContext";
import ToastHost from "./components/layout/ToastHost";
import ErrorBoundary from "./components/ErrorBoundary";
import { AdminAuthProvider } from "./portals/admin/AdminAuthContext";
import ProtectedAdminRoute from "./portals/admin/ProtectedAdminRoute";

const EmployeePortal = lazy(() => import("./portals/employee/EmployeePortal"));
const ResetPasswordPage = lazy(() => import("./portals/employee/ResetPasswordPage"));
const AdminLoginPage = lazy(() => import("./portals/admin/AdminLoginPage"));
const AdminDashboard = lazy(() => import("./portals/admin/AdminDashboard"));

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F2F5FF" }}>
      <div className="sv-spinner" role="status" aria-label="Loading" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppDataProvider>
        <BrowserRouter>
          <AdminAuthProvider>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route
                  path="/admin/*"
                  element={
                    <ProtectedAdminRoute>
                      <AdminDashboard />
                    </ProtectedAdminRoute>
                  }
                />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/*" element={<EmployeePortal />} />
              </Routes>
            </Suspense>
            <ToastHost />
          </AdminAuthProvider>
        </BrowserRouter>
      </AppDataProvider>
    </ErrorBoundary>
  );
}
