import { useEffect, useState } from 'react'
import { Text, Title1, Title2, Spinner } from '@fluentui/react-components'
import { DataBarVertical16Regular, Trophy16Regular, Star16Filled } from '@fluentui/react-icons'
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from 'framer-motion'
import { supabase } from '../services/supabase'
import { useResultsQuery } from '../hooks/useQueries'

function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 60, damping: 20 })
  const rounded = useTransform(spring, v => Math.round(v))
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    motionValue.set(value)
    const unsub = rounded.on('change', v => setDisplay(v))
    return unsub
  }, [value, motionValue, rounded])
  return <Text weight="semibold" className={className}>{display}</Text>
}

interface ResultItem {
  candidate_id: string
  nombre: string
  foto_url: string
  color_hex: string
  partido: string
  lema: string
  logo_partido_url: string
  votos: number
}

function BackgroundDecor() {
  return (
    <>
      <div className="fixed top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-40 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />
    </>
  )
}

export default function Results({ tvMode = false }: { tvMode?: boolean }) {
  const { data, isLoading, refetch } = useResultsQuery()

  useEffect(() => {
    refetch()

    const channel = supabase
      .channel('results-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, () => refetch())
      .subscribe()

    let interval: ReturnType<typeof setInterval>
    if (tvMode) interval = setInterval(() => refetch(), 5000)

    return () => {
      supabase.removeChannel(channel)
      if (interval) clearInterval(interval)
    }
  }, [tvMode, refetch])

  if (isLoading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner /></div>

  const results = data?.results ?? []
  const total = data?.total ?? 0

  const lider = results[0]
  const maxVotos = Math.max(...results.map(r => Number(r.votos)), 1)

  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    tvMode
      ? <>{children}</>
      : <div className="min-h-screen relative"><BackgroundDecor /><div className="max-w-4xl mx-auto px-4 py-6 md:py-10 relative z-10">{children}</div></div>

  return (
    <Wrapper>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl shadow-lg flex items-center justify-center">
            <DataBarVertical16Regular className="text-white !text-2xl" />
          </div>
          <Title1 className={tvMode ? '!text-5xl' : '!text-2xl md:!text-3xl'}>Resultados en Vivo</Title1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Text block className={`text-gray-500 ${tvMode ? '!text-2xl' : ''}`}>
              Total de votos:
            </Text>
            <AnimatedCount value={total} className={tvMode ? '!text-3xl !text-blue-600' : '!text-xl !text-blue-600'} />
          </div>
          {!tvMode && (
            <Text size={100} className="text-gray-400 mt-1">
              Los resultados se actualizan automáticamente en tiempo real
            </Text>
          )}
        </div>

        {/* Líder */}
        {lider && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.6 }}
            className={`mb-6 bg-gradient-to-r from-amber-50 to-orange-50/50 backdrop-blur-sm border border-amber-200/60 rounded-xl p-5 ${tvMode ? 'text-center' : ''}`}
          >
            <div className="flex items-center gap-4 justify-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <Trophy16Regular className="text-amber-600 !text-2xl" />
              </div>
              {lider.foto_url && (
                <img src={lider.foto_url} alt="" loading="lazy" className={`rounded-full object-cover shadow-sm ${tvMode ? 'w-24 h-24' : 'w-16 h-16'}`} />
              )}
              <div>
                <Title2 className={`${tvMode ? '!text-4xl' : '!text-xl'}`}>{lider.nombre}</Title2>
                <Text size={tvMode ? 500 : 300}>{lider.partido}</Text>
                <div className="flex items-center gap-2 mt-1">
                  <AnimatedCount value={Number(lider.votos)} className={tvMode ? '!text-3xl !text-amber-600' : '!text-xl !text-amber-600'} />
                  <Text size={tvMode ? 400 : 200}>
                    votos ({total > 0 ? ((Number(lider.votos) / total) * 100).toFixed(1) : 0}%)
                  </Text>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Barras de resultados */}
        <div className="space-y-3">
          <AnimatePresence>
            {results.map((r, i) => {
              const pct = total > 0 ? (Number(r.votos) / total) * 100 : 0
              const barPct = maxVotos > 0 ? (Number(r.votos) / maxVotos) * 100 : 0

              return (
                <motion.div
                  key={r.candidate_id}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className={`bg-white/80 backdrop-blur-xl rounded-xl shadow-sm border border-white/50 p-4 transition-all hover:shadow-md`}>
                    <div className={`flex items-center gap-4 ${tvMode ? 'py-3' : ''}`}>
                      <div className={`font-bold text-gray-400 ${tvMode ? 'text-3xl w-12' : 'text-lg w-8'}`}>#{i + 1}</div>
                      {r.foto_url && (
                        <img src={r.foto_url} alt="" loading="lazy" className={`rounded-full object-cover ${tvMode ? 'w-20 h-20' : 'w-12 h-12'}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="rounded-full flex-shrink-0" style={{ backgroundColor: r.color_hex, width: tvMode ? 16 : 10, height: tvMode ? 16 : 10 }} />
                          <Text weight="semibold" className={`truncate ${tvMode ? '!text-2xl' : 'text-sm'}`}>{r.nombre}</Text>
                          {i === 0 && <Star16Filled className="text-amber-500 text-sm" />}
                        </div>
                        <div className={`mt-1.5 bg-gray-100 rounded-full overflow-hidden ${tvMode ? 'h-8' : 'h-3'}`}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: r.color_hex }}
                            initial={{ width: 0 }}
                            animate={{ width: `${barPct}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                          />
                        </div>
                      </div>
                      <div className={`text-right flex-shrink-0 ${tvMode ? 'min-w-[150px]' : ''}`}>
                        <AnimatedCount value={Number(r.votos)} className={tvMode ? '!text-2xl' : '!text-sm'} />
                        <Text block size={tvMode ? 400 : 100} className={tvMode ? '!text-xl' : ''}>{pct.toFixed(1)}%</Text>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {results.length === 0 && (
          <div className="text-center py-12">
            <Text className={`text-gray-400 ${tvMode ? '!text-2xl' : ''}`}>
              Aún no hay votos registrados.
            </Text>
          </div>
        )}
      </motion.div>
    </Wrapper>
  )
}
