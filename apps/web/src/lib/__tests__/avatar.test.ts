import { hashString, getGradient, getInitials, GRADIENTS } from '@/lib/avatar';

describe('hashString', () => {
  it('is deterministic', () => {
    expect(hashString('alice')).toBe(hashString('alice'));
  });
  it('differs for different inputs', () => {
    expect(hashString('alice')).not.toBe(hashString('bob'));
  });
});

describe('getGradient', () => {
  it('returns a gradient pair from GRADIENTS', () => {
    const g = getGradient({ firstName: 'Alice', lastName: 'Martin' });
    const pairs = GRADIENTS.map(([f, t]) => `${f}|${t}`);
    expect(pairs).toContain(`${g.from}|${g.to}`);
  });
  it('returns angle in [0, 359]', () => {
    const g = getGradient({ firstName: 'Alice', lastName: 'Martin' });
    expect(g.angle).toBeGreaterThanOrEqual(0);
    expect(g.angle).toBeLessThan(360);
  });
  it('returns consistent gradient for same user case-insensitively', () => {
    const a = getGradient({ firstName: 'Alice', lastName: 'MARTIN' });
    const b = getGradient({ firstName: 'alice', lastName: 'martin' });
    expect(a).toEqual(b);
  });
});

describe('getInitials', () => {
  it('returns uppercased first letters', () => {
    expect(getInitials({ firstName: 'alice', lastName: 'martin' })).toBe('AM');
  });
  it('handles missing firstName', () => {
    expect(getInitials({ firstName: '', lastName: 'Martin' })).toBe('M');
  });
  it('handles missing lastName', () => {
    expect(getInitials({ firstName: 'Alice', lastName: '' })).toBe('A');
  });
  it('handles both missing', () => {
    expect(getInitials({ firstName: '', lastName: '' })).toBe('');
  });
});
