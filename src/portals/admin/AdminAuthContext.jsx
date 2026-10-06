/**
 * AdminAuthContext.jsx
 * ─────────────────────────────────────────────────────────────
 * Admin Portal session state — completely separate from employee
 * auth. Handles:
 *   • Session restore on refresh (Supabase persists JWT in localStorage)
 *   • 10-minute inactivity auto-logout (like banking apps)
 */
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../utils/supabaseClient";

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [adminLoggedIn, setAdminLoggedIn] = useState(null);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef(null);

  const doSignOut = useCallback(async () => {
    clearInterval(timerRef.current);
    await supabase.auth.signOut().catch(() => {});
    setAdminLoggedIn(false);
  }, []);

  // Reset the inactivity clock on any user interaction.
  const onActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Start the inactivity watcher once logged in; tear it down on sign-out.
  useEffect(() => {
    if (adminLoggedIn !== true) {
      clearInterval(timerRef.current);
      ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, onActivity));
      return;
    }

    lastActivityRef.current = Date.now();
    ACTIVITY_EVENTS.forEach((ev) => document.addEventListener(ev, onActivity, { passive: true }));

    timerRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= INACTIVITY_MS) {
        doSignOut();
      }
    }, 30_000); // check every 30 s

    return () => {
      clearInterval(timerRef.current);
      ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, onActivity));
    };
  }, [adminLoggedIn, onActivity, doSignOut]);

  // Restore session on mount and keep in sync with Supabase auth state.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAdminLoggedIn(data?.session ? true : false);
    }).catch(() => setAdminLoggedIn(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AdminAuthContext.Provider value={{ adminLoggedIn, setAdminLoggedIn, doSignOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  return ctx;
}
