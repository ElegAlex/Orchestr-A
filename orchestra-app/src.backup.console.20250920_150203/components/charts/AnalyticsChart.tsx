import React from 'react';
import { Box, Typography, Alert } from '@mui/material';

interface AnalyticsChartProps {
  data?: any[];
  dataKey?: string;
  height?: number;
  title?: string;
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ title = 'Graphique' }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        📊 {title}
      </Typography>
      <Alert severity="info">
        Graphiques temporairement simplifiés. L'onglet Gantt est maintenant disponible ! 🚀
      </Alert>
    </Box>
  );
};

export default AnalyticsChart;