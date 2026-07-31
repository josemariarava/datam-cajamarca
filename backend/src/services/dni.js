import logger from '../config/logger.js'

const API_URL = 'https://api.decolecta.com/v1/reniec/dni'

if (!process.env.DNI_API_TOKEN) {
  logger.warn('DNI_API_TOKEN no configurado. Solo funcionarán DNIs mockeados.')
}

const mockDB = process.env.NODE_ENV === 'production' ? {} : {
  '12345678': { nombres: 'Juan', apellido_paterno: 'Pérez', apellido_materno: 'López' },
  '87654321': { nombres: 'María', apellido_paterno: 'García', apellido_materno: 'Rodríguez' },
  '12345612': { nombres: 'Carlos', apellido_paterno: 'Arribasplata', apellido_materno: 'Tucto' },
  '12345613': { nombres: 'Carmen Rosa', apellido_paterno: 'Sifuentes', apellido_materno: 'Perez' },
  '03317006': { nombres: 'Santos', apellido_paterno: 'Ramirez', apellido_materno: 'Nima' },
  '26634259': { nombres: 'Mirian', apellido_paterno: 'Vasquez', apellido_materno: 'Villanueva' },
}

export async function consultarDNI(dni) {
  if (dni.length !== 8) throw new Error('DNI debe tener 8 dígitos')

  // Siempre revisar mock primero
  if (mockDB[dni]) {
    return { dni, ...mockDB[dni] }
  }

  // Consultar API real de decolecta.com
  const apiToken = process.env.DNI_API_TOKEN
  if (apiToken) {
    const res = await fetch(`${API_URL}?numero=${dni}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
    })
    if (!res.ok) throw new Error('Error al consultar DNI')

    const data = await res.json()
    if (!data.document_number) throw new Error('DNI no encontrado')

    return {
      dni,
      nombres: (data.first_name || '').trim(),
      apellido_paterno: (data.first_last_name || '').trim(),
      apellido_materno: (data.second_last_name || '').trim(),
    }
  }

  throw new Error('DNI no encontrado. El servicio de consulta DNI no está configurado.')
}
