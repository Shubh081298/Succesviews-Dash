/**
 * ProtectedAdminRoute.jsx
 * ─────────────────────────────────────────────────────────────
 * Route guard for the Admin Portal. If nobody is signed in as
 * admin, redirect to /admin/login instead of rendering the admin
 * dashboard — this is the mechanism that stops a bookmark/typed
 * URL to /admin from exposing admin data without a session.
 */
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthContext";

export default function ProtectedAdminRoute({ children }) {
  const { adminLoggedIn } = useAdminAuth();
  const location = useLocation();

  if (!adminLoggedIn) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}
