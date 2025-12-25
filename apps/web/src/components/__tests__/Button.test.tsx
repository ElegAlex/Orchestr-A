import { render, screen, fireEvent } from '@testing-library/react'

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
}

// Mock Button component
const Button = ({ children, onClick, variant = 'default', disabled = false }: ButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  )
}

describe('Button Component', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>)

    expect(screen.getByRole('button')).toHaveTextContent('Click me')
  })

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    fireEvent.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should not call onClick when disabled', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick} disabled>Click me</Button>)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()

    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should apply variant class', () => {
    render(<Button variant="primary">Click me</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('btn-primary')
  })
})
