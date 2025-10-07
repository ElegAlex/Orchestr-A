import React, { Suspense, lazy } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

// Lazy load du composant PlanningCalendar
const PlanningCalendar = lazy(() => import('../calendar/PlanningCalendar'));

const MyPlanning: React.FC = () => {
  const user = useSelector((state: RootState) => state.auth.user);

  if (!user) {
    return null;
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" mb={2}>📅 Mon planning</Typography>

        <Suspense
          fallback={
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
              <CircularProgress />
            </Box>
          }
        >
          <PlanningCalendar
            selectedProjects={[]}
            selectedUsers={[user.id]}
            selectedServices={[]}
          />
        </Suspense>
      </CardContent>
    </Card>
  );
};

export default MyPlanning;
