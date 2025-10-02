import React from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
} from '@mui/material';
import {
  Person as PersonIcon,
} from '@mui/icons-material';
import IndividualMilestoneDashboard from '../components/project/IndividualMilestoneDashboard';

const IndividualDashboard: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <PersonIcon color="primary" fontSize="large" />
          <Typography variant="h4" component="h1">
            Mon Hub Personnel
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Vue centralisée de vos tâches, jalons et projets avec déclaration de temps intégrée.
        </Typography>
      </Paper>

      <IndividualMilestoneDashboard />
    </Container>
  );
};

export default IndividualDashboard;