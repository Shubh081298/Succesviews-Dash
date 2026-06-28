/**
 * App.jsx
 * ─────────────────────────────────────────────────────────────
 * SuccessViews — top-level router.
 *
 * ARCHITECTURE (Employee Portal / Admin Portal separation):
 *   • The Employee Portal (src/portals/employee) lives at the app
 *     root ("/*") and contains ONLY employee-facing features: login,
 *     daily report (DSR), history, leave, settings/profile. It has
 *     zero admin buttons, links, or functionality, and imports
 *     nothing from src/portals/admin.
 *   • The Admin Portal (src/portals/admin) is a fully separate tree
 *     with its own login page (/admin/login) and dashboard (/admin),
 *     own navigation, and own auth — reached only by navigating
 *     directly to /admin/login, never via a link inside the
 *     Employee Portal.
 *   • Both portals share the same underlying data ("backend") via
 *     AppDataContext — employees, DSR submissions, leaves, etc. —
 *     but their UI, layouts, navigation, and authentication are
 *     completely separate codepaths.
 *   • ProtectedAdminRoute guards /admin/* so an unauthenticated
 *     visit (including a bookmarked or typed URL) redirects to
 *     /admin/login instead of exposing admin data.
 *
 * All the business logic, derived data, and tab components that
 * used to live in this single file have been split into:
 *   src/data/AppDataContext.jsx        — shared data/state layer
 *   src/portals/employee/EmployeePortal.jsx
 *   src/portals/admin/{AdminAuthContext,AdminLoginPage,
 *                       AdminDashboard,AdminTabs,ProtectedAdminRoute}.jsx
 */
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppDataProvider } from "./data/AppDataContext";
import ToastHost from "./components/layout/ToastHost";
import EmployeePortal from "./portals/employee/EmployeePortal";
import { AdminAuthProvider } from "./portals/admin/AdminAuthContext";
import AdminLoginPage from "./portals/admin/AdminLoginPage";
import AdminDashboard from "./portals/admin/AdminDashboard";
import ProtectedAdminRoute from "./portals/admin/ProtectedAdminRoute";

export default function App() {
  return (
    <AppDataProvider>
      <BrowserRouter>
        <AdminAuthProvider>
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
            <Route path="/*" element={<EmployeePortal />} />
          </Routes>
          <ToastHost />
        </AdminAuthProvider>
      </BrowserRouter>
    </AppDataProvider>
  );
}
