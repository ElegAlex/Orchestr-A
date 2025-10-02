import React from 'react';
import { Box } from '@mui/material';
import { OperationalDashboard as OperationalDashboardComponent } from '../components/dashboard/OperationalDashboard';

export const OperationalDashboard: React.FC = () => {
  return (
    <Box>
      <OperationalDashboardComponent />
    </Box>
  );
};

export default OperationalDashboard;