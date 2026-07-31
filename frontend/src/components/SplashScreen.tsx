import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search16Regular } from '@fluentui/react-icons'
import { useConfigPublic } from '../hooks/useQueries'

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [show, setShow] = useState(true)
  const { data: config } = useConfigPublic()

  const systemName = config?.system_name || 'DATAM CAJAMARCA'
  const tagline = config?.tagline || 'Tu voto importa'
  const primaryColor = config?.primary_color || '#2563eb'
  const secondaryColor = config?.secondary_color || '#7c3aed'

  useEffect(() => {
    const skipped = sessionStorage.getItem('splash_done')
    if (skipped) { onFinish(); return }

    const timer = setTimeout(() => {
      setShow(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [onFinish])

  return (
    <AnimatePresence onExitComplete={onFinish}>
      {show && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
          onClick={() => setShow(false)}
          aria-hidden="true"
        >
          <div className="text-center px-6">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 mx-auto mb-6 bg-white/20 backdrop-blur-md rounded-2xl shadow-lg flex items-center justify-center"
            >
              <Search16Regular className="text-white !text-3xl" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-white text-3xl md:text-4xl font-bold tracking-tight"
            >
              {systemName}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-white/70 text-base md:text-lg mt-2 font-light"
            >
              {tagline}
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex justify-center gap-1.5 mt-8"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-2 h-2 bg-white/60 rounded-full"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-white/30 text-xs mt-8"
            >
              Toca para continuar
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
