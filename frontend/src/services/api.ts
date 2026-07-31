import { supabase } from './supabase'

const API = '/api'

export async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  const res = await fetch(`${API}${path}`, { ...options, headers, signal: controller.signal })
  clearTimeout(timeout)

  if (res.status === 401) {
    await supabase.auth.signOut()
    window.location.href = '/login'
    throw new Error('Sesión expirada')
  }

  let data: any
  try {
    data = await res.json()
  } catch {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'El servidor no respondió. Verifica tu conexión e intenta de nuevo.')
  }
  if (!res.ok) throw new Error(data.error || 'Error del servidor')
  return data
}

export const authApi = {
  register: (body: { email: string; password: string; dni: string; telefono?: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  registerManual: (body: { email: string; password: string; dni: string; nombres: string; apellido_paterno: string; apellido_materno?: string; telefono?: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  consultarDNI: (dni: string) =>
    request<{ dni: string; nombres: string; apellido_paterno: string; apellido_materno: string }>('/auth/consultar-dni', { method: 'POST', body: JSON.stringify({ dni }) }),
  getProfile: () => request<{ id: string; dni: string; nombres: string; apellido_paterno: string; role: string; is_active: boolean }>('/auth/profile'),
}

export const candidatesApi = {
  getAll: () => request<{
    id: string; numero_lista: number; nombre: string; partido: string;
    lema: string; color_hex: string; foto_url: string; logo_partido_url: string;
    edad: number; profesion: string; cargo_actual: string; ubicacion: string;
    biografia: string; propuestas: string[]; logros_destacados: string[];
    activo: boolean; orden_prioridad: number;
  }[]>('/candidates'),
  create: (body: Record<string, unknown>) =>
    request('/candidates', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Record<string, unknown>) =>
    request(`/candidates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/candidates/${id}`, { method: 'DELETE' }),
}

export const votesApi = {
  register: (body: {
    dni_votante: string; nombres: string; apellido_paterno: string;
    apellido_materno?: string; candidate_id: string;
    direccion?: string; telefono?: string;
    location_lat?: number; location_lng?: number; location_address?: string;
  }) => request<{
    message: string; vote_id: string; verification_code: string;
    created_at: string; voter: { dni: string; nombres: string; apellido_paterno: string; apellido_materno: string };
  }>('/votes/register', { method: 'POST', body: JSON.stringify(body) }),

  getResults: () => request<{
    results: { candidate_id: string; nombre: string; foto_url: string; color_hex: string; partido: string; lema: string; logo_partido_url: string; votos: number }[];
    total: number;
  }>('/votes/results'),

  checkVoter: (dni: string) => request<{
    exists: boolean; voter?: { id?: string; dni: string; nombres: string; apellido_paterno: string; apellido_materno: string; direccion?: string; telefono?: string };
    has_voted?: boolean; vote?: { id: string; verification_code: string; created_at: string; candidate_id: string };
    fromMock?: boolean;
  }>(`/votes/check-voter/${dni}`),

  undoLast: () => request<{ message: string }>('/votes/undo-last', { method: 'DELETE' }),
}

export const verifyApi = {
  byDNI: (dni: string) => request<{
    verification_code: string; created_at: string;
    voter: { dni: string; nombres: string; apellido_paterno: string; apellido_materno: string };
    candidate: { nombre: string; foto_url: string; partido: string; color_hex: string; logo_partido_url: string; lema: string };
  }>(`/verify/${dni}`),

  byCode: (code: string) => request<{
    verification_code: string; created_at: string;
    voter: { dni: string; nombres: string; apellido_paterno: string; apellido_materno: string };
    candidate: { nombre: string; foto_url: string; partido: string; color_hex: string; logo_partido_url: string; lema: string };
  }>(`/votes/verify-code/${code}`),
}

export const encuestadorApi = {
  getDashboard: () => request<{
    hoy: number; total_general: number; mi_posicion: number;
    ultimos_votos: {
      id: string; created_at: string; verification_code: string;
      voter: { dni: string; nombres: string; apellido_paterno: string };
      candidate: { id: string; nombre: string; color_hex: string };
    }[];
    ranking: { id: string; nombres: string; apellido_paterno: string; votos: number }[];
  }>('/encuestador/dashboard'),
}

export const configApi = {
  getPublic: () => request<{
    system_name: string; tagline: string; logo_url: string | null;
    primary_color: string; secondary_color: string;
  }>('/config'),
}

export interface VoteRow {
  id: string
  verification_code: string
  created_at: string
  location_lat: number | null
  location_lng: number | null
  location_address: string | null
  voter: {
    dni: string; nombres: string; apellido_paterno: string; apellido_materno: string
    direccion: string | null; telefono: string | null
  }
  candidate: {
    id: string; nombre: string; partido: string; color_hex: string; foto_url: string
  }
  registered_by_profile: {
    nombres: string; apellido_paterno: string
  }
}

export const adminApi = {
  getStats: () => request<{
    total_encuestadores: number; total_votantes: number;
    total_votos: number; total_candidatos: number; participacion_pct: string;
  }>('/admin/stats'),

  getVotes: (page = 1, search = '') => request<{
    data: VoteRow[]; total: number; page: number; per_page: number
  }>(`/admin/votes?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}`),

  getEncuestadores: (page = 1) => request<{
    data: {
      id: string; dni: string; nombres: string; apellido_paterno: string;
      apellido_materno: string; role: string; is_active: boolean;
      total_votos_registrados: number; created_at: string;
    }[];
    total: number; page: number; per_page: number;
  }>(`/admin/encuestadores?page=${page}`),

  createEncuestador: (body: { email: string; password: string; dni: string }) =>
    request('/admin/encuestadores', { method: 'POST', body: JSON.stringify(body) }),

  toggleEncuestadorActive: (id: string) =>
    request(`/admin/encuestadores/${id}/toggle-active`, { method: 'PUT' }),

  getMapData: (page = 1) => request<{
    data: {
      id: string; location_lat: number; location_lng: number;
      location_address: string; created_at: string;
      candidate: { id: string; nombre: string; color_hex: string; partido: string };
      registered_by_profile: { nombres: string; apellido_paterno: string };
    }[];
    total: number; page: number; per_page: number;
  }>(`/admin/map-data?page=${page}`),

  resetVotes: () => request<{ message: string }>('/admin/reset', { method: 'POST' }),

  getConfig: () => request<{
    id: number; system_name: string; tagline: string; logo_url: string | null;
    primary_color: string; secondary_color: string;
    updated_by: string; updated_at: string;
  }>('/admin/config'),

  updateConfig: (body: {
    system_name?: string; tagline?: string; logo_url?: string | null;
    primary_color?: string; secondary_color?: string;
  }) => request<{
    id: number; system_name: string; tagline: string; logo_url: string | null;
    primary_color: string; secondary_color: string;
    updated_by: string; updated_at: string;
  }>('/admin/config', { method: 'PUT', body: JSON.stringify(body) }),

  exportData: async (format: 'xlsx' | 'csv' = 'xlsx') => {
    const token = await getToken()
    const res = await fetch(`${API}/admin/export?format=${format}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Error al exportar ${format === 'xlsx' ? 'Excel' : 'CSV'}`)
    return res.blob()
  },

  exportCSV: async () => adminApi.exportData('csv'),
}
