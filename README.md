# 🗳️ DATAM Cajamarca — Sistema de Votación

Sistema de votación digital para procesos electorales. Permite a **encuestadores** registrar votos puerta a puerta identificando votantes por DNI, con verificación QR, geolocalización, resultados en tiempo real y panel de administración completo.

## Stack Tecnológico

```
Frontend          Backend           Base de Datos
┌────────────┐   ┌────────────┐   ┌──────────────┐
│ React 19    │   │ Express 4   │   │ PostgreSQL    │
│ Vite 8      │   │ Supabase    │   │ + Supabase    │
│ Fluent UI   │   │ Service Role│   │ Row-Level Sec │
│ TailwindCSS │   │ JWT Auth    │   │ + Realtime    │
│ PWA (offline)│  │ Rate Limit  │   │ + Triggers    │
│ Leaflet     │   │ Helmet      │   │ + Views       │
│ Framer      │   │ Winston     │   │               │
│ Motion      │   │ Sentry      │   │               │
└────────────┘   └────────────┘   └──────────────┘
```

## Arquitectura

```
┌─ Cliente (Browser/PWA) ─────────────────────┐
│                                               │
│  React App (Vite)                             │
│  ├─ Login / Register                          │
│  ├─ RegisterVote (flujo 5 pasos)              │
│  ├─ Encuestador Dashboard                     │
│  ├─ Resultados en Vivo (Supabase Realtime)     │
│  ├─ Verificar Voto (QR / DNI)                 │
│  └─ Admin Panel                               │
│       ├─ Resumen + CSV Export                 │
│       ├─ CRUD Candidatos                      │
│       ├─ Gestión Encuestadores                │
│       └─ Mapa GPS (Leaflet + Clustering)      │
│                                               │
│  IndexedDB (Offline Queue)                    │
└──────────────┬──────────────────────────────┘
               │ HTTP (proxy /api)
               ▼
┌─ Backend (Node.js + Express) ─────────────┐
│                                            │
│  /api/auth      ─ Registro, login, perfil  │
│  /api/candidates ─ CRUD candidatos         │
│  /api/votes     ─ Registrar, verificar,    │
│  /api/encuestador ─ Dashboard personal     │
│  /api/admin     ─ Stats, export, reset     │
│  /api/verify    ─ Verificación pública     │
│                                            │
│  Middleware: auth JWT, admin guard,        │
│  rate limiting, helmet, morgan, sentry     │
└──────────────┬────────────────────────────┘
               │ Service Role Key
               ▼
┌─ Supabase ────────────────────────────────┐
│                                            │
│  Auth         ─ Supabase Auth (JWT)        │
│  Database     ─ PostgreSQL + RLS           │
│  Realtime     ─ Resultados en vivo         │
│  Storage      ─ (fotos candidatos)         │
└────────────────────────────────────────────┘
```

## Requisitos

- **Node.js** >= 22
- **npm** >= 10
- **Docker** + **Docker Compose** (opcional, para producción)
- Cuenta en [Supabase](https://supabase.com) (gratuita)

## Quick Start

### 1. Clonar e instalar

```bash
git clone https://github.com/josemariarava/datam-cajamarca.git
cd datam-cajamarca

# Backend
cd backend
cp .env.example .env   # Configurar variables
npm install

# Frontend
cd ../frontend
cp .env.example .env   # Configurar variables
npm install
```

### 2. Configurar Supabase

1. Crear proyecto en [Supabase](https://supabase.com)
2. Ir a **SQL Editor** → pegar contenido de `supabase/schema.sql` → ejecutar
3. Copiar credenciales a los archivos `.env`

### 3. Iniciar en desarrollo

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Abrir [http://localhost:5173](http://localhost:5173)

### 4. Docker (producción)

```bash
docker compose up --build
```

Abrir [http://localhost](http://localhost)

## Variables de Entorno

### Backend (`backend/.env`)

| Variable | Descripción | Obligatorio |
|----------|-------------|:-----------:|
| `SUPABASE_URL` | URL del proyecto Supabase | ✅ |
| `SUPABASE_ANON_KEY` | Clave anónima (pública) | ✅ |
| `SUPABASE_SERVICE_KEY` | Clave service_role (privada) | ✅ |
| `PORT` | Puerto del servidor (default: 3001) | ❌ |
| `DNI_API_TOKEN` | Token de apiperu.dev para consulta DNI | ❌ |
| `FRONTEND_URL` | Origen permitido por CORS | ❌ |
| `SENTRY_DSN` | DSN de Sentry para error tracking | ❌ |

### Frontend (`frontend/.env`)

| Variable | Descripción | Obligatorio |
|----------|-------------|:-----------:|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima | ✅ |
| `VITE_SENTRY_DSN` | DSN de Sentry para error tracking | ❌ |

## Estructura del Proyecto

```
datam/
├── backend/
│   ├── src/
│   │   ├── config/       # Configuración Supabase
│   │   ├── middleware/    # Auth, admin guard
│   │   ├── routes/       # auth, votes, candidates, admin, encuestador
│   │   ├── services/     # DNI consultation (mock + API)
│   │   └── index.js      # Entry point
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/   # CelebrationScreen, ProtectedRoute
│   │   ├── contexts/     # AuthContext, ToastContext
│   │   ├── pages/        # 8 páginas (lazy loaded)
│   │   └── services/     # api, supabase, offline
│   ├── public/
│   ├── Dockerfile
│   └── .env.example
│
├── supabase/
│   └── schema.sql        # Esquema completo + RLS + triggers
│
├── nginx/
│   └── default.conf      # Configuración Nginx producción
│
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci.yml        # CI pipeline
│
└── README.md
```

## API Reference

### Auth

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| POST | `/api/auth/register` | ❌ | Registrar encuestador |
| POST | `/api/auth/consultar-dni` | ❌ | Consultar datos por DNI |
| GET | `/api/auth/profile` | ✅ | Obtener perfil propio |

### Votos

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| POST | `/api/votes/register` | ✅ | Registrar voto |
| GET | `/api/votes/check-voter/:dni` | ✅ | Verificar si ya votó |
| GET | `/api/votes/verify/:dni` | ❌ | Verificar voto por DNI |
| GET | `/api/votes/verify-code/:code` | ❌ | Verificar voto por código |
| GET | `/api/votes/results` | ❌ | Resultados en vivo |
| DELETE | `/api/votes/undo-last` | ✅ | Deshacer último voto (5 min) |

### Admin

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/api/admin/stats` | Admin | Estadísticas globales |
| GET | `/api/admin/encuestadores` | Admin | Listar encuestadores |
| POST | `/api/admin/encuestadores` | Admin | Crear encuestador |
| PUT | `/api/admin/encuestadores/:id/toggle-active` | Admin | Activar/desactivar |
| GET | `/api/admin/map-data` | Admin | Datos para mapa GPS |
| GET | `/api/admin/export` | Admin | Exportar CSV |
| POST | `/api/admin/reset` | Admin | Resetear votación |

## Roles y Permisos

| Rol | Acceso |
|-----|--------|
| **admin** | Panel completo: estadísticas, CRUD candidatos, gestión encuestadores, mapa GPS, export CSV, reset |
| **encuestador** | Registrar votos, ver su dashboard personal, ver resultados |
| **Sin auth** | Ver resultados, verificar voto por DNI/código |

## Despliegue

### Producción con Docker

```bash
# 1. Clonar y configurar
git clone https://github.com/josemariarava/datam-cajamarca.git
cd datam-cajamarca
cp backend/.env.example backend/.env
# Editar backend/.env con tus credenciales de Supabase

# 2. Iniciar
docker compose up -d --build

# 3. Verificar
curl http://localhost/api/health
```

### Producción manual (sin Docker)

```bash
# Backend
cd backend
npm ci
npm run start        # o: pm2 start src/index.js --name votapp-backend

# Frontend (build static)
cd frontend
npm ci
npm run build        # genera frontend/dist/

# Servir con nginx (ver nginx/default.conf)
```

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e
```

## Monitoreo

- **Sentry**: Error tracking en frontend y backend
- **Morgan**: Logging HTTP requests
- **Winston**: Logging estructurado con rotación
- **Audit Log**: Tabla `audit_log` con operaciones sensibles (reset, toggle, undo)

## Licencia

MIT
