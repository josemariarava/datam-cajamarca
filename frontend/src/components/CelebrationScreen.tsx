import { useEffect, useCallback } from 'react'
import { Button, Text, Title1 } from '@fluentui/react-components'
import { CheckmarkStarburst16Filled, Share16Regular, Copy16Regular, DocumentArrowDown16Regular } from '@fluentui/react-icons'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { toPng } from 'html-to-image'
import { useToast } from '../contexts/ToastContext'

interface Props {
  voterName: string
  verificationCode: string
  candidateName: string
  candidateColor: string
  onNewVote: () => void
}

export default function CelebrationScreen({ voterName, verificationCode, candidateName, candidateColor, onNewVote }: Props) {
  const { showToast } = useToast()

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

  const handleShare = useCallback(async () => {
    const text = `🗳️ Voto registrado\n\nVotante: ${voterName}\nCandidato: ${candidateName}\nCódigo: ${verificationCode}\n\nVerifica aquí: ${verifyUrl}`
    if (navigator.share) {
      await navigator.share({ title: 'Comprobante de Voto', text, url: verifyUrl })
      showToast('Comprobante compartido', 'success')
    } else {
      await navigator.clipboard.writeText(verifyUrl)
      showToast('Enlace copiado al portapapeles', 'success')
    }
  }, [voterName, candidateName, verificationCode, verifyUrl, showToast])

  const handleCopyCode = useCallback(async () => {
    await navigator.clipboard.writeText(verificationCode)
    showToast('Código copiado', 'success')
  }, [verificationCode, showToast])

  const handleDownload = useCallback(async () => {
    const el = document.getElementById('vote-ticket')
    if (!el) return
    try {
      const dataUrl = await toPng(el, { backgroundColor: '#ffffff', pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `comprobante-voto-${verificationCode}.png`
      link.href = dataUrl
      link.click()
      showToast('Comprobante descargado', 'success')
    } catch {
      showToast('Error al descargar', 'error')
    }
  }, [verificationCode, showToast])

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6 md:p-8 text-center">
      <motion.div
        initial={{ rotate: -20, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
      >
        <CheckmarkStarburst16Filled className="text-6xl text-yellow-500" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Title1 className="mt-4">¡Voto Registrado!</Title1>
        <Text size={500} className="mt-2 block">
          Gracias, <strong>{voterName}</strong>
        </Text>
        <Text className="mt-1 block font-semibold" style={{ color: candidateColor }}>
          Votaste por: {candidateName}
        </Text>
      </motion.div>

      {/* Ticket design */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="max-w-sm mx-auto mt-8 relative"
      >
        {/* Ticket top cut */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-[#f0f4ff] rounded-b-full" />
        <div className="absolute -top-2 left-4 w-4 h-4 bg-[#f0f4ff] rounded-b-full" />
        <div className="absolute -top-2 right-4 w-4 h-4 bg-[#f0f4ff] rounded-b-full" />

        <div id="vote-ticket" className="bg-white border-2 border-dashed rounded-xl p-6 shadow-lg"
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
              <div key={i} className="w-2 h-2 bg-[#f0f4ff] rounded-full" />
            ))}
          </div>
        </div>

        {/* Ticket bottom cut */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-[#f0f4ff] rounded-t-full" />
        <div className="absolute -bottom-2 left-4 w-4 h-4 bg-[#f0f4ff] rounded-t-full" />
        <div className="absolute -bottom-2 right-4 w-4 h-4 bg-[#f0f4ff] rounded-t-full" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 space-y-3"
      >
        <div className="flex gap-2">
          <Button
            appearance="primary"
            icon={<Share16Regular />}
            className="flex-1 !rounded-xl"
            onClick={handleShare}
          >
            Compartir
          </Button>
          <Button
            appearance="subtle"
            icon={<Copy16Regular />}
            className="flex-1 !rounded-xl"
            onClick={handleCopyCode}
          >
            Copiar código
          </Button>
          <Button
            appearance="subtle"
            icon={<DocumentArrowDown16Regular />}
            className="flex-1 !rounded-xl"
            onClick={handleDownload}
          >
            Descargar
          </Button>
        </div>
        <Button
          appearance="primary"
          size="large"
          className="w-full !rounded-xl !shadow-lg !shadow-blue-500/30"
          onClick={onNewVote}
        >
          Registrar otro voto
        </Button>
      </motion.div>
    </div>
  )
}
