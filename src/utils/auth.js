/**
 * auth.js
 * ─────────────────────────────────────────────────────────────
 * Employee + Admin authentication helpers.
 *
 * Passwords are hashed with bcryptjs (pure JS, works in browser).
 * Plain text passwords are NEVER stored in the database.
 *
 * Usage:
 *   import { loginEmployee, loginAdmin, hashPassword } from './auth'
 */
import bcrypt from "bcryptjs";
import { supabase } from "./supabaseClient";

const SALT_ROUNDS = 10;

/* ── Password utilities ──────────────────────────────────────── */

/** Hash a plain text password before storing in DB */
export async function hashPassword(plainText) {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/** Compare a plain text password against a stored hash */
export async function verifyPassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

/* ── Employee login ──────────────────────────────────────────── */

/**
 * Finds an employee by their ID, then verifies the password.
 * Returns { success: true, employee } or { success: false, error }
 */
export async function loginEmployee(employeeId, plainPassword) {
  try {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();

    if (error || !data) {
      return { success: false, error: "Employee not found." };
    }

    const valid = await verifyPassword(plainPassword, data.password_hash);
    if (!valid) {
      return { success: false, error: "Incorrect password." };
    }

    // Never return the password hash to the frontend
    const { password_hash, ...safeEmployee } = data;
    return { success: true, employee: safeEmployee };
  } catch (err) {
    return { success: false, error: "Login failed. Please try again." };
  }
}

/* ── Admin login ─────────────────────────────────────────────── */

/**
 * Checks the admin password stored in the settings table.
 * Returns { success: true } or { success: false, error }
 */
export async function loginAdmin(plainPassword) {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "admin_password_hash")
      .single();

    if (error || !data) {
      return { success: false, error: "Admin settings not found." };
    }

    const valid = await verifyPassword(plainPassword, data.value);
    if (!valid) {
      return { success: false, error: "Incorrect admin password." };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: "Admin login failed." };
  }
}

/* ── Change admin password ───────────────────────────────────── */

export async function updateAdminPassword(newPlainPassword) {
  const hash = await hashPassword(newPlainPassword);
  const { error } = await supabase
    .from("settings")
    .update({ value: hash })
    .eq("key", "admin_password_hash");
  return { success: !error, error: error?.message };
}

/* ── Reset employee password ─────────────────────────────────── */

export async function resetEmployeePassword(employeeId, newPlainPassword) {
  const hash = await hashPassword(newPlainPassword);
  const { error } = await supabase
    .from("employees")
    .update({ password_hash: hash })
    .eq("id", employeeId);
  return { success: !error, error: error?.message };
}


/* ============================================================
   Supabase Auth helpers (email/password login, reset, OTP).
   Employees authenticate against Supabase Auth (auth.users).
   The bcrypt helpers above remain for the admin-managed
   `employees` table copy and legacy flows.
   ============================================================ */

/** Employee email + password sign in via Supabase Auth. */
export async function employeeSignIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true, user: data.user };
}

/** Sign the current user out of Supabase Auth. */
export async function employeeSignOut() {
  try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
}

/** Send a password-reset email; the link lands on /reset-password. */
export async function sendPasswordReset(email) {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { success: !error, error: error?.message };
}

/** Set a new password for the currently authenticated (recovery) user. */
export async function updateCurrentUserPassword(newPassword) {
  const { data: userData } = await supabase.auth.getUser();
  const email = userData?.user?.email || null;
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { success: !error, error: error?.message, email };
}

/** Admin forgot-password: send a one-time code to the admin email. */
export async function adminSendOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return { success: !error, error: error?.message };
}

/** Admin forgot-password: verify the emailed one-time code. */
export async function adminVerifyOtp(email, token) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  return { success: !error, error: error?.message };
}


/** Admin forgot-password (magic link): emails a one-click sign-in link that
    returns to /admin/login. Works with Supabase's default email template —
    no custom SMTP or {{ .Token }} edit required. */
export async function adminSendMagicLink(email) {
  const redirectTo = `${window.location.origin}/admin/login`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
  });
  return { success: !error, error: error?.message };
}
