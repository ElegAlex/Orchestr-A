import { render, screen, fireEvent } from '@testing-library/react';
import { UserAvatar } from '@/components/UserAvatar';

const user = { id: '1', firstName: 'Alice', lastName: 'Martin' };

describe('UserAvatar', () => {
  it('renders monogram when no avatarUrl nor avatarPreset', () => {
    render(<UserAvatar user={user} />);
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('renders image when avatarUrl is provided', () => {
    render(<UserAvatar user={{ ...user, avatarUrl: '/avatars/persona_01.svg' }} />);
    const img = screen.getByAltText('Alice Martin');
    expect(img).toHaveAttribute('src', expect.stringContaining('persona_01.svg'));
  });

  it('renders preset when avatarPreset is provided (not initials)', () => {
    render(<UserAvatar user={{ ...user, avatarPreset: 'persona_03' }} />);
    const img = screen.getByAltText('Alice Martin');
    expect(img).toHaveAttribute('src', '/avatars/persona_03.svg');
  });

  it('renders monogram when avatarPreset is "initials"', () => {
    render(<UserAvatar user={{ ...user, avatarPreset: 'initials' }} />);
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(<UserAvatar user={user} badge={<span data-testid="b">★</span>} />);
    expect(screen.getByTestId('b')).toBeInTheDocument();
  });

  it('does not render badge when absent', () => {
    render(<UserAvatar user={user} />);
    expect(screen.queryByTestId('b')).toBeNull();
  });

  it('falls back to monogram on image error', () => {
    render(<UserAvatar user={{ ...user, avatarPreset: 'persona_03' }} />);
    const img = screen.getByAltText('Alice Martin');
    fireEvent.error(img);
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('renders title attribute with full name', () => {
    const { container } = render(<UserAvatar user={user} />);
    expect(container.querySelector('[title="Alice Martin"]')).toBeInTheDocument();
  });
});
