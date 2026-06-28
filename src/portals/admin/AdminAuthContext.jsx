/**
 * AdminAuthContext.jsx
 * ─────────────────────────────────────────────────────────────
 * Admin Portal session state — completely separate from employee
 * auth (see EmployeePortal.jsx, which keeps its own `emp`/`loggedIn`
 * state). Lifted to a small context (rather than local component
 * state) so it survives navigation between /admin/login and /admin
 * — both are different routed components, so the "is an admin
 * currently signed in" flag has to live above both of them.
 */
import { createContext, useContext, useState } from "react";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  return (
    <AdminAuthContext.Provider value={{ adminLoggedIn, setAdminLoggedIn }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  return ctx;
}
