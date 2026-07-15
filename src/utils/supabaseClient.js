/**
 * supabaseClient.js
 * ─────────────────────────────────────────────────────────────
 * Single shared Supabase client instance for the entire app.
 * Import { supabase } from this file wherever you need DB access.
 *
 * Keys are loaded from .env (never hardcoded here).
 *
 * "Remember me" support:
 *   The auth session is stored in localStorage (persists across
 *   browser restarts) when the user ticks Remember Me, otherwise in
 *   sessionStorage (cleared when the tab closes). The choice is read
 *   from the `svd_remember` flag, which the login screen sets just
 *   before calling signIn.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Check your .env file has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

const REMEMBER_KEY = "svd_remember";

const rememberOn = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "false";
  } catch (e) {
    return true;
  }
};

/**
 * Storage adapter that routes the Supabase auth session to either
 * localStorage (remember me) or sessionStorage (this tab only).
 * Reads check both so an in-progress session is always found.
 */
const rememberAwareStorage = {
  getItem: (key) => {
    try {
      const v = localStorage.getItem(key);
      if (v !== null && v !== undefined) return v;
      return sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      if (rememberOn()) {
        localStorage.setItem(key, value);
        try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
      } else {
        sessionStorage.setItem(key, value);
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      /* storage unavailable — ignore */
    }
  },
  removeItem: (key) => {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: rememberAwareStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
