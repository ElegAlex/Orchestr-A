import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { ExecutiveDashboard as ExecutiveDashboardComponent } from '../components/dashboard/ExecutiveDashboard';

export const ExecutiveDashboard: React.FC = () => {
  return (
    <Box>
      <ExecutiveDashboardComponent />
    </Box>
  );
};

export default ExecutiveDashboard;