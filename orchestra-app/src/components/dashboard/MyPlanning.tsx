import React, { Suspense, lazy } from 'react';
import {
  Box,
  CircularProgress,
} from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

// Lazy load du composant PlanningCalendar
const PlanningCalendar = lazy(() => import('../calendar/PlanningCalendar'));

interface MyPlanningProps {
  onNewTask?: () => void;
}

const MyPlanning: React.FC<MyPlanningProps> = ({ onNewTask }) => {
  const user = useSelector((state: RootState) => state.auth.user);

  if (!user) {
    return null;
  }

  return (
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
        hideServicesFilter={true}
        onNewTask={onNewTask}
      />
    </Suspense>
  );
};

export default MyPlanning;
