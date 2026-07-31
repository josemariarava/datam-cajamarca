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

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `🗳️ *¡Yo voté en DATAM Cajamarca!*\n\nMi código de verificación: *${verificationCode}*\nVerifica aquí: ${verifyUrl}`
  )}`

  const handleWhatsApp = useCallback(() => {
    window.open(whatsappUrl, '_blank')
  }, [whatsappUrl])

  const handleShare = useCallback(async () => {
    const text = `🗳️ Voto registrado\n\nVotante: ${voterName}\nCandidato: ${candidateName}\nCódigo: ${verificationCode}\n\nVerifica aquí: ${verifyUrl}`
    if (navigator.share) {
      await navigator.share({ title: 'Mi Voto - DATAM Cajamarca', text, url: verifyUrl })
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
      {/* Checkmark */}
      <motion.div
        initial={{ rotate: -20, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
      >
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
          <CheckmarkStarburst16Filled className="text-4xl text-white" />
        </div>
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

      {/* Ticket diseño vertical "¡Yo Voté!" */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 120 }}
        className="max-w-xs mx-auto mt-8"
      >
        <div id="vote-ticket" className="bg-white rounded-2xl shadow-lg overflow-hidden"
          style={{ boxShadow: `0 8px 32px ${candidateColor}20` }}>

          {/* Barra superior de color */}
          <div className="h-2" style={{ background: `linear-gradient(90deg, ${candidateColor}, ${candidateColor}88, ${candidateColor})` }} />

          <div className="p-6 text-center">
            {/* Marca */}
            <Text size={100} className="text-gray-400 uppercase tracking-[0.2em] block">🗳️ DATAM CAJAMARCA</Text>

            {/* Check grande animado */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
              className="my-4"
            >
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-9 h-9">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              </div>
            </motion.div>

            {/* ¡YO VOTÉ! */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Text weight="bold" size={900} className="block leading-none" style={{ color: candidateColor }}>
                ¡YO VOTÉ!
              </Text>
            </motion.div>

            {/* Nombre del votante */}
            <Text weight="semibold" size={400} className="block mt-4 text-gray-700">
              {voterName}
            </Text>

            {/* Candidato */}
            <Text size={200} className="block mt-1 text-gray-500">
              Candidato: <span className="font-semibold text-gray-700">{candidateName}</span>
            </Text>

            {/* Separador */}
            <div className="my-5 border-t border-dashed border-gray-200" />

            {/* QR */}
            <div className="flex justify-center">
              <div className="p-2 bg-white rounded-xl shadow-sm border" style={{ borderColor: candidateColor + '30' }}>
                <QRCodeSVG value={verifyUrl} size={130} level="H" />
              </div>
            </div>

            {/* Código de verificación */}
            <Text size={100} className="text-gray-400 block mt-3 uppercase tracking-wider">Código de verificación</Text>
            <Text weight="bold" size={500} className="tracking-[0.25em] block mt-1 font-mono" style={{ color: candidateColor }}>
              {verificationCode}
            </Text>

            <Text size={100} className="text-gray-400 mt-3 block">
              Escanea el QR para verificar tu voto
            </Text>

            {/* República de puntos al final (efecto ticket) */}
            <div className="flex gap-1 justify-center mt-5">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: candidateColor + '20' }} />
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Botones de acción */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 space-y-3"
      >
        <div className="grid grid-cols-2 gap-2">
          <Button
            appearance="primary"
            icon={<span>💬</span>}
            className="!rounded-xl !h-12"
            style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}
            onClick={handleWhatsApp}
          >
            WhatsApp
          </Button>
          <Button
            appearance="primary"
            icon={<Share16Regular />}
            className="!rounded-xl !h-12"
            onClick={handleShare}
          >
            Compartir
          </Button>
          <Button
            appearance="subtle"
            icon={<Copy16Regular />}
            className="!rounded-xl !h-12"
            onClick={handleCopyCode}
          >
            Copiar código
          </Button>
          <Button
            appearance="subtle"
            icon={<DocumentArrowDown16Regular />}
            className="!rounded-xl !h-12"
            onClick={handleDownload}
          >
            Descargar
          </Button>
        </div>
        <Button
          appearance="primary"
          size="large"
          className="w-full !rounded-xl !shadow-lg !shadow-blue-500/30 !h-12"
          onClick={onNewVote}
        >
          Registrar otro voto
        </Button>
      </motion.div>
    </div>
  )
}
