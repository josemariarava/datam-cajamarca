import { useQuery } from '@tanstack/react-query'
import { candidatesApi, encuestadorApi, votesApi, adminApi, configApi } from '../services/api'

export function useCandidates() {
  return useQuery({
    queryKey: ['candidates'],
    queryFn: candidatesApi.getAll,
    staleTime: 5 * 60 * 1000,
  })
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: encuestadorApi.getDashboard,
    staleTime: 30 * 1000,
  })
}

export function useResultsQuery() {
  return useQuery({
    queryKey: ['results'],
    queryFn: votesApi.getResults,
    staleTime: 30 * 1000,
  })
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getStats,
    staleTime: 2 * 60 * 1000,
  })
}

export function useEncuestadores(page = 1) {
  return useQuery({
    queryKey: ['admin', 'encuestadores', page],
    queryFn: () => adminApi.getEncuestadores(page),
    staleTime: 60 * 1000,
  })
}

export function useVotes(page = 1, search = '') {
  return useQuery({
    queryKey: ['admin', 'votes', page, search],
    queryFn: () => adminApi.getVotes(page, search),
    staleTime: 30 * 1000,
  })
}

export function useMapData(page = 1) {
  return useQuery({
    queryKey: ['admin', 'map-data', page],
    queryFn: () => adminApi.getMapData(page),
    staleTime: 60 * 1000,
  })
}

export function useConfigPublic() {
  return useQuery({
    queryKey: ['config'],
    queryFn: configApi.getPublic,
    staleTime: 5 * 60 * 1000,
  })
}
