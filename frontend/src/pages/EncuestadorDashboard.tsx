import { Text, Title1, Title2, Spinner, Badge } from '@fluentui/react-components'
import { Grid16Regular, DocumentText16Regular, Trophy16Regular, Person16Regular } from '@fluentui/react-icons'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useDashboard } from '../hooks/useQueries'

function BackgroundDecor() {
  return (
    <>
      <div className="fixed top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-40 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />
    </>
  )
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-4 text-center">
      <div className="w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
        <span className="text-blue-600" style={{ color }}>{icon}</span>
      </div>
      <Title2 className="!text-2xl" style={{ color }}>{value}</Title2>
      <Text size={200} className="text-gray-500 block">{label}</Text>
    </div>
  )
}

export default function EncuestadorDashboard() {
  const { user, profile } = useAuth()
  const { data, isLoading } = useDashboard()

  if (isLoading || !data) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner /></div>

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 18) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  return (
    <div className="min-h-screen relative">
      <BackgroundDecor />
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white text-lg shadow-sm">
              {profile?.nombres?.[0] || <Person16Regular />}
            </div>
            <div>
              <Title1 className="!text-xl md:!text-2xl">{greeting}, {profile?.nombres || 'encuestador'}</Title1>
              <Text size={200} className="text-gray-400">Aquí están tus estadísticas de hoy</Text>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 md:gap-4 my-6">
            <StatCard icon={<Grid16Regular />} value={data.hoy} label="Votos hoy" color="#2563eb" />
            <StatCard icon={<DocumentText16Regular />} value={data.total_general} label="Total registrados" color="#16a34a" />
            <StatCard icon={<Trophy16Regular />} value={`#${data.mi_posicion}`} label="En el ranking" color="#d97706" />
          </div>

          {/* Ranking */}
          {data.ranking?.length > 0 && (
            <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Trophy16Regular className="text-amber-600" />
                </div>
                <Title2 className="!text-lg">Ranking del día</Title2>
              </div>
              <div className="space-y-1">
                {data.ranking.map((r: any, i: number) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                      r.id === user?.id ? 'bg-blue-50/80 border border-blue-100/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-200 text-gray-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        #{i + 1}
                      </div>
                      <Text size={300}>{r.nombres} {r.apellido_paterno}</Text>
                      {r.id === user?.id && (
                        <Badge appearance="tint" size="small" className="!text-[10px]">Tú</Badge>
                      )}
                    </div>
                    <Text weight="semibold" size={200} className="text-gray-600">{r.votos} votos</Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Últimos votos */}
          <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <DocumentText16Regular className="text-blue-600" />
              </div>
              <Title2 className="!text-lg">Últimos votos registrados</Title2>
            </div>
            <div className="space-y-1">
              {data.ultimos_votos?.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <Text size={300}>{v.voter?.nombres} {v.voter?.apellido_paterno}</Text>
                    <Text size={100} className="text-gray-400">DNI: {v.voter?.dni}</Text>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.candidate?.color_hex }} />
                      <Text size={200}>{v.candidate?.nombre}</Text>
                    </div>
                    <Text size={100} className="text-gray-400 block">
                      {new Date(v.created_at).toLocaleTimeString('es-PE')}
                    </Text>
                  </div>
                </div>
              ))}
              {(!data.ultimos_votos || data.ultimos_votos.length === 0) && (
                <Text className="text-gray-400 text-center py-4">Aún no has registrado votos hoy</Text>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
