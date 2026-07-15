// ============================================================
// Supabase Edge Function: admin-users
// ------------------------------------------------------------
// Creates / updates the Supabase Auth user for an employee using the
// service-role key (which must NEVER live in the frontend). The admin
// panel calls this via supabase.functions.invoke("admin-users", ...)
// when an employee is created or their password is reset.
//
// Deploy:
//   supabase functions deploy admin-users
// No secret to set: SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL are injected
// into every Edge Function automatically.
//
// Body: { action: "upsert", email: string, password: string }
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { action, email, password } = await req.json();
    if (action !== "upsert" || !email || !password) {
      return json({ error: "Expected { action:'upsert', email, password }" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Find an existing auth user with this email.
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) return json({ error: listErr.message }, 500);
    const existing = list.users.find(
      (u) => (u.email || "").toLowerCase() === String(email).toLowerCase(),
    );

    let uid: string;
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
      if (error) return json({ error: error.message }, 500);
      uid = existing.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // no confirmation email needed for admin-created users
      });
      if (error) return json({ error: error.message }, 500);
      uid = data.user.id;
    }

    // Keep the employees row linked to the auth user.
    await admin.from("employees").update({ auth_uid: uid }).eq("email", email);

    return json({ ok: true, uid });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
