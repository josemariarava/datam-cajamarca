import { useEffect } from 'react'
import { Button, Text, Title1, Title2 } from '@fluentui/react-components'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'

interface Props {
  voterName: string
  verificationCode: string
  candidateName: string
  candidateColor: string
  onNewVote: () => void
}

export default function CelebrationScreen({ voterName, verificationCode, candidateName, candidateColor, onNewVote }: Props) {
  useEffect(() => {
    import('canvas-confetti').then(({ default: confetti }) => {
      const duration = 1500
      const end = Date.now() + duration
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: [candidateColor, '#FFD700'],
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: [candidateColor, '#FF6B6B'],
        })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    })
  }, [candidateColor])

  const verifyUrl = `${window.location.origin}/verificar?code=${verificationCode}`

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', duration: 0.6 }}
      className="text-center py-6"
    >
      <motion.div
        initial={{ rotate: -20, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
      >
        <span className="text-6xl">🎉</span>
      </motion.div>

      <Title1 className="mt-4">¡Voto Registrado!</Title1>
      <Text size={500} className="mt-2 block">
        Gracias, <strong>{voterName}</strong>
      </Text>
      <Text className="mt-1 block" style={{ color: candidateColor }}>
        Votaste por: <strong>{candidateName}</strong>
      </Text>

      {/* Ticket design */}
      <div className="max-w-sm mx-auto mt-8 relative">
        {/* Ticket top cut */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-gray-50 rounded-b-full" />
        <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-50 rounded-b-full" />
        <div className="absolute -top-2 right-4 w-4 h-4 bg-gray-50 rounded-b-full" />

        <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 shadow-lg"
          style={{ borderColor: candidateColor + '40' }}>
          <div className="text-center border-b border-gray-200 pb-4 mb-4" style={{ borderColor: candidateColor + '30' }}>
            <Text weight="semibold" size={400}>🗳️ Comprobante de Voto</Text>
          </div>

          <div className="flex justify-center my-4">
            <div className="p-3 bg-white rounded-xl shadow-sm border">
              <QRCodeSVG value={verifyUrl} size={160} level="H" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2">
            <div className="flex justify-between items-center">
              <Text size={200} className="text-gray-500">Código</Text>
              <Text weight="semibold" size={400} className="tracking-widest">{verificationCode}</Text>
            </div>
            <div className="flex justify-between items-center">
              <Text size={200} className="text-gray-500">Candidato</Text>
              <Text weight="semibold" size={300}>{candidateName}</Text>
            </div>
          </div>

          <Text size={100} className="text-gray-400 mt-3 block text-center">
            Escanea el QR o guarda el código para verificar tu voto
          </Text>

          {/* Perforated edge */}
          <div className="flex gap-1 justify-center mt-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="w-2 h-2 bg-gray-50 rounded-full" />
            ))}
          </div>
        </div>

        {/* Ticket bottom cut */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-gray-50 rounded-t-full" />
        <div className="absolute -bottom-2 left-4 w-4 h-4 bg-gray-50 rounded-t-full" />
        <div className="absolute -bottom-2 right-4 w-4 h-4 bg-gray-50 rounded-t-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button appearance="primary" size="large" className="mt-8" onClick={onNewVote}>
          Registrar otro voto
        </Button>
      </motion.div>
    </motion.div>
  )
}
