-- ============================================================
-- Auth User Management — RPC functions for managing Supabase Auth
-- users directly from Postgres. These replace the Edge Function
-- "admin-users" and run server-side with SECURITY DEFINER.
--
-- Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

-- 1) Create or update an auth user for an employee.
--    Called when adding an employee or resetting their password.
CREATE OR REPLACE FUNCTION upsert_auth_user(
  p_email TEXT,
  p_password TEXT,
  p_employee_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_uid UUID;
  v_exists BOOLEAN;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_uid
  FROM auth.users
  WHERE email = LOWER(p_email)
  LIMIT 1;

  v_exists := v_uid IS NOT NULL;

  IF v_exists THEN
    -- Update password for existing user
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf')),
        updated_at = NOW(),
        banned_until = NULL
    WHERE id = v_uid;
  ELSE
    -- Create new auth user
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      aud, role, confirmation_token
    ) VALUES (
      v_uid, '00000000-0000-0000-0000-000000000000',
      LOWER(p_email), crypt(p_password, gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::JSONB,
      '{}'::JSONB,
      'authenticated', 'authenticated', ''
    );

    -- Create identity record (required for email login)
    INSERT INTO auth.identities (
      id, user_id, provider_id, provider,
      identity_data, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_uid, v_uid, LOWER(p_email), 'email',
      jsonb_build_object('sub', v_uid::TEXT, 'email', LOWER(p_email)),
      NOW(), NOW(), NOW()
    );
  END IF;

  -- Link employee row to auth user
  IF p_employee_id IS NOT NULL THEN
    UPDATE public.employees
    SET auth_id = v_uid::TEXT
    WHERE id = p_employee_id;
  END IF;

  RETURN jsonb_build_object('uid', v_uid, 'created', NOT v_exists);
END;
$$;

-- 2) Disable an auth user (ban indefinitely). Called on employee termination.
CREATE OR REPLACE FUNCTION disable_auth_user(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  UPDATE auth.users
  SET banned_until = '2099-12-31'::TIMESTAMPTZ,
      updated_at = NOW()
  WHERE email = LOWER(p_email);
END;
$$;

-- 3) Re-enable an auth user (remove ban). Called on employee reactivation.
CREATE OR REPLACE FUNCTION enable_auth_user(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  UPDATE auth.users
  SET banned_until = NULL,
      updated_at = NOW()
  WHERE email = LOWER(p_email);
END;
$$;

-- Grant execute to authenticated users (admin is authenticated via admin login)
GRANT EXECUTE ON FUNCTION upsert_auth_user(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_auth_user(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION disable_auth_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION disable_auth_user(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION enable_auth_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION enable_auth_user(TEXT) TO anon;
