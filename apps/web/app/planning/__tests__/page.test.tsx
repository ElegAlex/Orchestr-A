import { render, screen } from '@testing-library/react';

// Mock des composants
jest.mock('@/components/MainLayout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

jest.mock('@/components/planning/PlanningView', () => ({
  PlanningView: (props: { showFilters: boolean; showControls: boolean; showGroupHeaders: boolean; showLegend: boolean }) => (
    <div data-testid="planning-view">
      <span data-testid="show-filters">{String(props.showFilters)}</span>
      <span data-testid="show-controls">{String(props.showControls)}</span>
      <span data-testid="show-group-headers">{String(props.showGroupHeaders)}</span>
      <span data-testid="show-legend">{String(props.showLegend)}</span>
    </div>
  ),
}));

// Import après les mocks
import PlanningPage from '../page';

describe('PlanningPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the page within MainLayout', () => {
    render(<PlanningPage />);

    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
  });

  it('should render PlanningView component', () => {
    render(<PlanningPage />);

    expect(screen.getByTestId('planning-view')).toBeInTheDocument();
  });

  it('should pass showFilters=true to PlanningView', () => {
    render(<PlanningPage />);

    expect(screen.getByTestId('show-filters')).toHaveTextContent('true');
  });

  it('should pass showControls=true to PlanningView', () => {
    render(<PlanningPage />);

    expect(screen.getByTestId('show-controls')).toHaveTextContent('true');
  });

  it('should pass showGroupHeaders=true to PlanningView', () => {
    render(<PlanningPage />);

    expect(screen.getByTestId('show-group-headers')).toHaveTextContent('true');
  });

  it('should pass showLegend=true to PlanningView', () => {
    render(<PlanningPage />);

    expect(screen.getByTestId('show-legend')).toHaveTextContent('true');
  });

  it('should render without crashing', () => {
    const { container } = render(<PlanningPage />);

    expect(container).toBeTruthy();
  });
});
