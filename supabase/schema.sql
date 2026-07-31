-- ============================================
-- ESQUEMA COMPLETO - Sistema de Votación
-- ============================================

-- 1. PERFILES / ENCUESTADORES (extiende auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  dni VARCHAR(8) UNIQUE NOT NULL,
  nombres VARCHAR(255) NOT NULL,
  apellido_paterno VARCHAR(255) NOT NULL,
  apellido_materno VARCHAR(255) DEFAULT '',
  telefono VARCHAR(15) DEFAULT '',
  role VARCHAR(20) DEFAULT 'encuestador' CHECK (role IN ('admin', 'encuestador')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. VOTANTES (personas que emiten voto, NO hacen login)
CREATE TABLE IF NOT EXISTS public.voters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni VARCHAR(8) UNIQUE NOT NULL,
  nombres VARCHAR(255) NOT NULL,
  apellido_paterno VARCHAR(255) NOT NULL,
  apellido_materno VARCHAR(255) DEFAULT '',
  direccion TEXT DEFAULT '',
  telefono VARCHAR(15) DEFAULT '',
  foto_url TEXT DEFAULT '',
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CANDIDATOS (enriquecido)
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_lista INT,
  nombre VARCHAR(255) NOT NULL,
  partido VARCHAR(255) DEFAULT '',
  lema VARCHAR(255) DEFAULT '',
  color_hex VARCHAR(7) DEFAULT '#3B82F6',
  foto_url TEXT DEFAULT '',
  logo_partido_url TEXT DEFAULT '',
  edad INT,
  profesion VARCHAR(255) DEFAULT '',
  cargo_actual VARCHAR(255) DEFAULT '',
  ubicacion VARCHAR(255) DEFAULT '',
  biografia TEXT DEFAULT '',
  propuestas TEXT[] DEFAULT '{}',
  logros_destacados TEXT[] DEFAULT '{}',
  activo BOOLEAN DEFAULT TRUE,
  orden_prioridad INT DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VOTOS
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID REFERENCES public.voters(id) ON DELETE CASCADE UNIQUE NOT NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  registered_by UUID REFERENCES public.profiles(id) NOT NULL,
  location_lat DECIMAL(10,7),
  location_lng DECIMAL(10,7),
  location_address TEXT DEFAULT '',
  verification_code VARCHAR(8) UNIQUE,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_votes_candidate ON public.votes(candidate_id);
CREATE INDEX IF NOT EXISTS idx_votes_registered_by ON public.votes(registered_by);
CREATE INDEX IF NOT EXISTS idx_voters_dni ON public.voters(dni);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_candidates_activo ON public.candidates(activo);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Usuarios ven su propio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admin ve todos los perfiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- VOTERS
CREATE POLICY "Encuestadores pueden ver voters"
  ON public.voters FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE));

CREATE POLICY "Encuestadores pueden crear voters"
  ON public.voters FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE));

-- CANDIDATES
CREATE POLICY "Cualquiera puede ver candidatos activos"
  ON public.candidates FOR SELECT
  USING (activo = TRUE OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin gestiona candidatos"
  ON public.candidates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin edita candidatos"
  ON public.candidates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin elimina candidatos"
  ON public.candidates FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- VOTES
CREATE POLICY "Encuestadores ven sus propios votos"
  ON public.votes FOR SELECT
  USING (registered_by = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Encuestadores registran votos"
  ON public.votes FOR INSERT
  WITH CHECK (
    registered_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE)
  );

-- ============================================
-- FUNCIÓN: generar código de verificación (8 chars alfanuméricos)
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_verification_code()
RETURNS VARCHAR(8) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code VARCHAR(8) := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || SUBSTRING(chars FROM CAST(floor(random() * LENGTH(chars) + 1) AS INT) FOR 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: asignar código de verificación al insertar voto (con reintento en colisión)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_vote_insert()
RETURNS TRIGGER AS $$
DECLARE
  tries INT := 0;
BEGIN
  LOOP
    NEW.verification_code := public.generate_verification_code();
    BEGIN
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries >= 10 THEN
        NEW.verification_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
        RETURN NEW;
      END IF;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_vote_insert
  BEFORE INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_vote_insert();

-- ============================================
-- VISTA: resultados en tiempo real
-- ============================================

CREATE OR REPLACE VIEW public.vote_results AS
SELECT
  c.id AS candidate_id,
  c.nombre,
  c.foto_url,
  c.color_hex,
  c.partido,
  c.lema,
  c.logo_partido_url,
  COUNT(v.id) AS votos
FROM public.candidates c
LEFT JOIN public.votes v ON v.candidate_id = c.id
WHERE c.activo = TRUE
GROUP BY c.id, c.nombre, c.foto_url, c.color_hex, c.partido, c.lema, c.logo_partido_url
ORDER BY votos DESC;

-- ============================================
-- AUDITORÍA: operaciones sensibles
-- ============================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action VARCHAR(50) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CONFIGURACIÓN DEL SISTEMA
-- ============================================

CREATE TABLE IF NOT EXISTS public.system_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  system_name TEXT NOT NULL DEFAULT 'Datam Cajamarca',
  tagline TEXT NOT NULL DEFAULT 'Tu voto importa',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  secondary_color TEXT DEFAULT '#7c3aed',
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.system_config (id, system_name, tagline)
VALUES (1, 'Datam Cajamarca', 'Tu voto importa')
ON CONFLICT (id) DO NOTHING;
