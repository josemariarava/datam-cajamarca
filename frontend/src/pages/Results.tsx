import { useEffect, useState, useRef } from 'react'
import { Card, Text, Title1, Title2, Spinner } from '@fluentui/react-components'
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from 'framer-motion'
import { votesApi } from '../services/api'
import { supabase } from '../services/supabase'

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

export default function Results({ tvMode = false }: { tvMode?: boolean }) {
  const [results, setResults] = useState<ResultItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadResults()

    const channel = supabase
      .channel('results-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, loadResults)
      .subscribe()

    let interval: ReturnType<typeof setInterval>
    if (tvMode) interval = setInterval(loadResults, 5000)

    return () => {
      supabase.removeChannel(channel)
      if (interval) clearInterval(interval)
    }
  }, [tvMode])

  const loadResults = async () => {
    try {
      const data = await votesApi.getResults()
      setResults(data.results)
      setTotal(data.total)
    } catch { } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Spinner /></div>

  const lider = results[0]
  const maxVotos = Math.max(...results.map(r => Number(r.votos)), 1)

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={tvMode ? 'p-12' : 'max-w-4xl mx-auto p-6'}
    >
      <Title1 className={`text-center mb-2 ${tvMode ? '!text-5xl' : ''}`}>Resultados en Vivo</Title1>
      <Text block className={`text-center mb-8 text-gray-500 ${tvMode ? '!text-2xl' : ''}`}>
        Total de votos: {total}
      </Text>

      {/* Líder */}
      {lider && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className={`mb-8 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-400 rounded-xl p-6 ${tvMode ? 'text-center' : ''}`}
        >
          <div className="flex items-center gap-4 justify-center">
            <span className="text-4xl">🏆</span>
            {lider.foto_url && (
              <img src={lider.foto_url} alt="" className={`rounded-full object-cover ${tvMode ? 'w-24 h-24' : 'w-16 h-16'}`} />
            )}
            <div>
              <Title2 className={tvMode ? '!text-4xl' : ''}>{lider.nombre}</Title2>
              <Text size={tvMode ? 500 : 400}>{lider.partido}</Text>
              <div className="flex items-center gap-2 mt-1">
                <AnimatedCount value={Number(lider.votos)} className={tvMode ? '!text-3xl' : '!text-xl'} />
                <Text size={tvMode ? 400 : 300}>
                  votos ({total > 0 ? ((Number(lider.votos) / total) * 100).toFixed(1) : 0}%)
                </Text>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Barras de resultados */}
      <div className="space-y-4">
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
                <Card>
                  <div className={`flex items-center gap-4 ${tvMode ? 'py-3' : ''}`}>
                    <div className={`font-bold text-gray-400 ${tvMode ? 'text-3xl w-12' : 'text-xl w-8'}`}>#{i + 1}</div>
                    {r.foto_url && (
                      <img src={r.foto_url} alt="" className={`rounded-full object-cover ${tvMode ? 'w-20 h-20' : 'w-14 h-14'}`} />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`rounded-full`} style={{ backgroundColor: r.color_hex, width: tvMode ? 16 : 12, height: tvMode ? 16 : 12 }} />
                        <Text weight="semibold" className={tvMode ? '!text-2xl' : ''}>{r.nombre}</Text>
                        {i === 0 && <span className="text-lg">👑</span>}
                      </div>
                      <div className={`mt-2 bg-gray-200 rounded-full overflow-hidden ${tvMode ? 'h-8' : 'h-4'}`}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: r.color_hex }}
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                        />
                      </div>
                    </div>
                    <div className={`text-right ${tvMode ? 'min-w-[150px]' : ''}`}>
                      <AnimatedCount value={Number(r.votos)} className={tvMode ? '!text-2xl' : ''} />
                      <Text block size={200} className={tvMode ? '!text-xl' : ''}>{pct.toFixed(1)}%</Text>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {results.length === 0 && (
        <Text className={`text-center block mt-8 ${tvMode ? '!text-2xl' : ''}`}>
          Aún no hay votos registrados.
        </Text>
      )}
    </motion.div>
  )

  if (tvMode) {
    return <div className="min-h-screen bg-white">{content}</div>
  }

  return content
}
