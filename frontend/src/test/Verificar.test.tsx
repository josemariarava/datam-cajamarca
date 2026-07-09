import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Verificar from '../pages/Verificar'

describe('Verificar page', () => {
  it('renders title and input', () => {
    render(
      <MemoryRouter>
        <Verificar />
      </MemoryRouter>
    )
    expect(screen.getByText('Verificar mi voto')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('DNI (8 dígitos)')).toBeInTheDocument()
  })
})
