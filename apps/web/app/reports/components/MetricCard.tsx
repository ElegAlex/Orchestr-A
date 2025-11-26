import { Metric } from '../types';

interface MetricCardProps {
  metric: Metric;
}

const colorMap = {
  primary: 'bg-blue-100 text-blue-800',
  secondary: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-cyan-100 text-cyan-800',
};

export function MetricCard({ metric }: MetricCardProps) {
  const getTrendIcon = () => {
    switch (metric.trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '−';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorMap[metric.color]}`}>
          <span className="text-2xl">{metric.trend && getTrendIcon()}</span>
        </div>
        <div className="flex-1">
          <div className="text-3xl font-bold text-gray-900">{metric.value}</div>
          <div className="text-sm font-medium text-gray-900">{metric.title}</div>
          {metric.change && (
            <div className="text-xs text-gray-900 mt-1">{metric.change}</div>
          )}
        </div>
      </div>
    </div>
  );
}
