-- ==================================================
-- DIGI-DOC DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Target Database: Supabase PostgreSQL
-- ==================================================

-- Enable pgcrypto for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================================================
-- 1. PROFILES TABLE (Mirrors Supabase Auth Users)
-- ==================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Automatic Profile Creation Trigger on Auth Sign-Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to prevent duplicates
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==================================================
-- 2. PACKAGES TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  access_code VARCHAR(9) UNIQUE NOT NULL, -- Format: XXXX-XXXX
  pin_hash VARCHAR(255) DEFAULT NULL, -- Hashed PIN or null
  status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('CREATED', 'ACTIVE', 'CLAIMED', 'EXPIRED', 'REVOKED')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  download_count INT DEFAULT 0 NOT NULL CHECK (download_count >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==================================================
-- 3. PACKAGE FILES TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS public.package_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL, -- Storage bucket object path
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  mime_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==================================================
-- 4. PACKAGE ACCESS LOGS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS public.package_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('VERIFY', 'DOWNLOAD', 'AUTH_FAIL')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  error_reason VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==================================================
-- 5. SECURITY AUDIT EVENTS TABLE
-- ==================================================
CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==================================================
-- INDEXES FOR HIGH PERFORMANCE
-- ==================================================
CREATE INDEX IF NOT EXISTS idx_packages_access_code ON public.packages (access_code);
CREATE INDEX IF NOT EXISTS idx_packages_sender_id ON public.packages (sender_id);
CREATE INDEX IF NOT EXISTS idx_packages_status_expiry ON public.packages (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_package_files_package_id ON public.package_files (package_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_package_id ON public.package_access_logs (package_id);
CREATE INDEX IF NOT EXISTS idx_security_events_actor ON public.security_audit_events (actor_id);

-- ==================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==================================================

-- 1. Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. Packages RLS
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Senders can view own packages"
  ON public.packages FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "Senders can create packages"
  ON public.packages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Senders can update own packages"
  ON public.packages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Senders can delete own packages"
  ON public.packages FOR DELETE
  USING (auth.uid() = sender_id);

-- 3. Package Files RLS
ALTER TABLE public.package_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Senders can view files of own packages"
  ON public.package_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.packages p 
      WHERE p.id = package_id AND p.sender_id = auth.uid()
    )
  );

CREATE POLICY "Senders can insert files for own packages"
  ON public.package_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.packages p 
      WHERE p.id = package_id AND p.sender_id = auth.uid()
    )
  );

CREATE POLICY "Senders can delete files of own packages"
  ON public.package_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.packages p 
      WHERE p.id = package_id AND p.sender_id = auth.uid()
    )
  );

-- 4. Package Access Logs RLS
ALTER TABLE public.package_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Senders can view access logs of own packages"
  ON public.package_access_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.packages p 
      WHERE p.id = package_id AND p.sender_id = auth.uid()
    )
  );

-- 5. Security Audit Events RLS
ALTER TABLE public.security_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Actors can view own audit events"
  ON public.security_audit_events FOR SELECT
  USING (auth.uid() = actor_id);
