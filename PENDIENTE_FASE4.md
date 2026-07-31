# 🗂️ PENDIENTE — Fase 4: Defensa en Profundidad (RLS + User-Scoped Client)

> Documentación de la deuda técnica de seguridad identificada durante el audit de Julio 2026.
> Pendiente para próxima actualización.

## Objetivo

Reemplazar `supabaseAdmin` (service_role key) por un cliente Supabase autenticado con el JWT del usuario en cada request, para que las políticas RLS de la base de datos realmente protejan los datos.

## Problema actual

Todas las rutas usan `supabaseAdmin` que **bypassea RLS**. La seguridad depende 100% de que los middlewares `requireAuth` y `requireAdmin` funcionen correctamente. Si hay un bug en esos middlewares, la DB queda expuesta.

---

## Cambios necesarios

### 1. Middleware `attachSupabaseClient` (nuevo archivo)

`backend/src/middleware/supabaseClient.js`

- Toma el token JWT del header `Authorization`
- Crea un cliente Supabase autenticado:
  ```js
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  ```
- Lo asigna a `req.supabase`
- Se ejecuta en cascada con `requireAuth`

### 2. Políticas RLS faltantes

| Tabla | Operación | Política necesaria |
|-------|-----------|-------------------|
| `voters` | **UPDATE** | Encuestadores activos pueden actualizar voters |
| `votes` | **DELETE** | Encuestador puede eliminar su propio voto (< 5 min) |
| `system_config` | **SELECT** | Cualquiera puede leer configuración pública |
| `system_config` | **UPDATE** | Solo admin |
| `audit_log` | **INSERT** | Usuarios autenticados pueden insertar audit_log |

### 3. Funciones `SECURITY DEFINER` (bypass RLS controlado)

Para rutas públicas que necesitan leer datos sin auth:

```sql
-- Verificación pública (no requiere auth)
CREATE FUNCTION public.verify_vote_by_dni(dni text)
RETURNS JSONB
SECURITY DEFINER
AS $$ ... $$;

-- Verificación por código (no requiere auth)
CREATE FUNCTION public.verify_vote_by_code(code text)
RETURNS JSONB
SECURITY DEFINER
AS $$ ... $$;

-- Resultados públicos (todos los votos, sin filtrar por encuestador)
CREATE FUNCTION public.get_public_results()
RETURNS JSONB
SECURITY DEFINER
AS $$ ... $$;

-- Ranking diario (cruza profiles + votes)
CREATE FUNCTION public.get_daily_ranking()
RETURNS JSONB
SECURITY DEFINER
AS $$ ... $$;

-- Check voter (busca votante + si ya votó)
CREATE FUNCTION public.check_voter(dni text)
RETURNS JSONB
SECURITY DEFINER
AS $$ ... $$;
```

### 4. Migración de rutas

| Ruta | Cliente a usar | Motivo |
|------|---------------|--------|
| `candidates.js GET` | `req.supabase` | RLS pública para activos |
| `candidates.js POST/PUT/DELETE` | `req.supabase` | RLS admin check |
| `votes.js POST /register` | `req.supabase` + funciones SECURITY DEFINER para voter upsert | RLS cubre SELECT/INSERT |
| `votes.js DELETE /undo-last` | `req.supabase` | Requiere nueva DELETE policy |
| `votes.js GET /results` | Función `get_public_results()` | Sin auth, necesita bypass |
| `votes.js GET /verify/:dni` | Función `verify_vote_by_dni()` | Sin auth |
| `votes.js GET /verify-code/:code` | Función `verify_vote_by_code()` | Sin auth |
| `votes.js GET /check-voter/:dni` | Función `check_voter()` + `req.supabase` para SELECT | Auth requerido |
| `verify.js GET /:dni` | Función `verify_vote_by_dni()` | Sin auth |
| `encuestador.js GET /dashboard` | `get_daily_ranking()` + `req.supabase` | Ranking necesita todos los datos |
| `admin.js` (todas) | `req.supabase` | RLS admin exception |
| `auth.js GET /profile` | `req.supabase` | RLS "ver propio perfil" |
| `admin.js POST /reset` | Función SECURITY DEFINER + chequeo extra | DELETE no cubierto por RLS |
| `admin.js POST /encuestadores` | **Mantener `supabaseAdmin`** | `auth.admin.createUser()` requiere service_role |
| `auth.js POST /register` | **Mantener `supabaseAdmin`** | `auth.admin.createUser()` requiere service_role |

### 5. Limpieza final

- Eliminar import `supabaseAdmin` de rutas donde ya no se use
- Mantenerlo solo en:
  - `auth.js` (creación de usuarios)
  - `admin.js` (creación de usuarios)
  - Funciones SECURITY DEFINER (necesitan service_role para ejecutar SQL que bypassea RLS)

---

## Rutas que conservan `supabaseAdmin` (justificado)

| Ruta | Razón |
|------|-------|
| `auth.js POST /register` | `supabaseAdmin.auth.admin.createUser()` solo funciona con service_role key |
| `auth.js POST /consultar-dni` | Consulta a API externa (no toca DB) |
| `admin.js POST /encuestadores` | `supabaseAdmin.auth.admin.createUser()` |
| Todas las funciones SECURITY DEFINER | Necesitan `supabaseAdmin` para ejecutar SQL que bypassea RLS |

---

## Riesgos identificados

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Ruta pública rota (verify/results) | Baja | Probar cada función SECURITY DEFINER individualmente antes de migrar la ruta |
| Ranking de encuestador muestra solo sus datos | Media | La función `get_daily_ranking()` debe estar bien escrita |
| DELETE policy demasiado permisiva | Baja | Restringir por tiempo (5 min) y ownership |
| Regresión en vote registration | Media | Probar flujo completo: check-voter → register → verify |

---

## Estimación

- **1-2 días** de desarrollo
- **1 día** de pruebas manuales + integración
