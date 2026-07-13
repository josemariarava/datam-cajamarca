import { useState, useCallback } from 'react'

export function useGeolocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [address, setAddress] = useState('')
  const [capturing, setCapturing] = useState(false)

  const startCapture = useCallback(() => {
    if (!navigator.geolocation) return
    setCapturing(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&accept-language=es`)
          .then(r => r.json())
          .then(d => setAddress(d.display_name || ''))
          .catch(() => {})
          .finally(() => setCapturing(false))
      },
      () => setCapturing(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    )
  }, [])

  return { coords, address, capturing, startCapture }
}
