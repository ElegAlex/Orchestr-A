import React from 'react';
import { Box, Typography, Alert } from '@mui/material';

const AdvancedAnalytics: React.FC = () => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        📊 Analyses avancées
      </Typography>
      <Alert severity="info">
        Analyses avancées temporairement simplifiées. L'onglet Gantt est maintenant disponible ! 🚀
      </Alert>
    </Box>
  );
};

export default AdvancedAnalytics;