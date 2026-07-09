import { useEffect, useState } from 'react'
import { Card, CardHeader, Text, Title1, Title2, Spinner, Badge } from '@fluentui/react-components'
import { motion } from 'framer-motion'
import { encuestadorApi, votesApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function EncuestadorDashboard() {
  const [data, setData] = useState<any>(null)
  const { user, profile } = useAuth()

  useEffect(() => {
    encuestadorApi.getDashboard().then(setData).catch(() => {})
  }, [])

  if (!data) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner /></div>

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  return (
    <div className="max-w-4xl mx-auto p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Title1>{greeting}, {profile?.nombres || 'encuestador'} 👋</Title1>
        <Text className="text-gray-500">Buen trabajo, aquí están tus estadísticas</Text>

        <div className="grid grid-cols-3 gap-4 my-6">
          <Card>
            <CardHeader header={<Title2 className="text-blue-600">📊 {data.hoy}</Title2>} />
            <Text>Votos hoy</Text>
          </Card>
          <Card>
            <CardHeader header={<Title2 className="text-green-600">📋 {data.total_general}</Title2>} />
            <Text>Total registrados</Text>
          </Card>
          <Card>
            <CardHeader header={<Title2 className="text-amber-600">🏆 #{data.mi_posicion}</Title2>} />
            <Text>En el ranking hoy</Text>
          </Card>
        </div>

        {/* Ranking */}
        {data.ranking?.length > 0 && (
          <Card className="mb-6">
            <CardHeader header={<Title2>Ranking del día</Title2>} />
            <div className="space-y-2">
              {data.ranking.map((r: any, i: number) => (
                <div key={r.id} className={`flex items-center justify-between p-2 rounded ${r.id === user?.id ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <Text weight="bold" size={500}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </Text>
                    <Text>{r.nombres} {r.apellido_paterno}</Text>
                    {r.id === user?.id && <Badge appearance="tint">Tú</Badge>}
                  </div>
                  <Text weight="semibold">{r.votos} votos</Text>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Últimos votos registrados */}
        <Card>
          <CardHeader header={<Title2>Últimos votos registrados</Title2>} />
          <div className="space-y-2">
            {data.ultimos_votos?.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between p-2 border-b last:border-0">
                <div>
                  <Text>{v.voter?.nombres} {v.voter?.apellido_paterno}</Text>
                  <Text size={200} className="text-gray-400">DNI: {v.voter?.dni}</Text>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v.candidate?.color_hex }} />
                    <Text size={200}>{v.candidate?.nombre}</Text>
                  </div>
                  <Text size={100} className="text-gray-400">
                    {new Date(v.created_at).toLocaleTimeString('es-PE')}
                  </Text>
                </div>
              </div>
            ))}
            {(!data.ultimos_votos || data.ultimos_votos.length === 0) && (
              <Text className="text-gray-400">Aún no has registrado votos hoy</Text>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
