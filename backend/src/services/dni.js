const API_URL = 'https://apiperu.dev/api/dni'

if (!process.env.DNI_API_TOKEN || process.env.DNI_API_TOKEN === 'your_apiperu_token') {
  console.warn('⚠️ DNI_API_TOKEN no configurado. Solo funcionarán DNIs mockeados.')
}

const mockDB = {
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

  // Si hay token válido (no placeholder), consultar API real
  const apiToken = process.env.DNI_API_TOKEN
  if (apiToken && apiToken !== 'your_apiperu_token') {
    const res = await fetch(`${API_URL}/${dni}?token=${apiToken}`)
    if (!res.ok) throw new Error('Error al consultar DNI')

    const data = await res.json()
    if (!data.success) throw new Error('DNI no encontrado')

    return {
      dni,
      nombres: data.nombres,
      apellido_paterno: data.apellido_paterno,
      apellido_materno: data.apellido_materno,
    }
  }

  throw new Error('DNI no encontrado. El servicio de consulta DNI no está configurado.')
}
