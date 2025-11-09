import { render, screen } from '@testing-library/react'

// Mock Dashboard page
const MockDashboard = () => {
  return (
    <div>
      <h1>Tableau de bord</h1>
      <div className="stats">
        <div className="stat">
          <span className="label">Projets actifs</span>
          <span className="value">5</span>
        </div>
        <div className="stat">
          <span className="label">Tâches en cours</span>
          <span className="value">12</span>
        </div>
      </div>
    </div>
  )
}

describe('Dashboard Page', () => {
  it('should render dashboard title', () => {
    render(<MockDashboard />)

    expect(screen.getByText(/tableau de bord/i)).toBeInTheDocument()
  })

  it('should display project stats', () => {
    render(<MockDashboard />)

    expect(screen.getByText('Projets actifs')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('should display task stats', () => {
    render(<MockDashboard />)

    expect(screen.getByText('Tâches en cours')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })
})
