import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme, CssBaseline, CircularProgress, Box } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';
import { store } from './store';
import { setUser } from './store/slices/authSlice';
import { authService } from './services/auth.service';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationProvider } from './components/NotificationProvider';
import { LoginForm } from './components/auth/LoginForm';
import { MainLayout } from './components/layout/MainLayout';
import { PrivateRoute } from './components/PrivateRoute';

// Lazy-loaded components for better performance
const DashboardHub = React.lazy(() => import('./pages/DashboardHubV2'));
const Projects = React.lazy(() => import('./pages/Projects').then(module => ({ default: module.Projects })));
const ProjectCreate = React.lazy(() => import('./pages/ProjectCreate').then(module => ({ default: module.ProjectCreate })));
const ProjectDetail = React.lazy(() => import('./pages/ProjectDetail'));
const ProjectEdit = React.lazy(() => import('./pages/ProjectEdit').then(module => ({ default: module.ProjectEdit })));
const Tasks = React.lazy(() => import('./pages/Tasks').then(module => ({ default: module.Tasks })));
const SimpleResources = React.lazy(() => import('./pages/SimpleResources'));
const Calendar = React.lazy(() => import('./pages/Calendar'));
const Reports = React.lazy(() => import('./pages/Reports'));
const HRAdmin = React.lazy(() => import('./pages/HRAdmin'));
const Settings = React.lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Profile = React.lazy(() => import('./pages/Profile'));
const TeamSupervision = React.lazy(() => import('./pages/TeamSupervision'));

// Loading fallback component
const LoadingFallback = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="200px"
    flexDirection="column"
    gap={2}
  >
    <CircularProgress />
    <span>Chargement...</span>
  </Box>
);

// Wrapper pour forcer le remontage de ProjectDetail
const ProjectDetailWrapper = () => {
  const location = useLocation();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProjectDetail key={location.pathname} />
    </Suspense>
  );
};

const theme = createTheme({
  palette: {
    primary: {
      main: '#667eea',
    },
    secondary: {
      main: '#764ba2',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: {
    borderRadius: 8,
  },
});

function AppContent() {
  const [authInitialized, setAuthInitialized] = React.useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const user = await authService.getUserProfile(firebaseUser.uid);
          if (!user) {
            // Ne PAS créer automatiquement un profil !
            // L'utilisateur doit avoir un profil existant créé par un admin
            console.warn('Utilisateur Firebase sans profil Firestore:', firebaseUser.email);
            await authService.signOut(); // Déconnecter immédiatement
            store.dispatch(setUser(null));
            setAuthInitialized(true);
            return;
          }
          store.dispatch(setUser(user));
        } catch (error) {
          console.error('Error loading user profile:', error);
          store.dispatch(setUser(null));
        }
      } else {
        store.dispatch(setUser(null));
      }
      setAuthInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  if (!authInitialized) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard-hub" replace />} />
          <Route path="dashboard" element={<Navigate to="/dashboard-hub" replace />} />
          <Route path="dashboard-hub" element={
            <Suspense fallback={<LoadingFallback />}>
              <DashboardHub />
            </Suspense>
          } />
          <Route path="projects" element={
            <Suspense fallback={<LoadingFallback />}>
              <Projects />
            </Suspense>
          } />
          <Route path="projects/create" element={
            <Suspense fallback={<LoadingFallback />}>
              <ProjectCreate />
            </Suspense>
          } />
          <Route path="projects/:projectId" element={
            <ProjectDetailWrapper />
          } />
          <Route path="projects/:projectId/edit" element={
            <Suspense fallback={<LoadingFallback />}>
              <ProjectEdit />
            </Suspense>
          } />
          <Route path="tasks" element={
            <Suspense fallback={<LoadingFallback />}>
              <Tasks />
            </Suspense>
          } />
          <Route path="simple-resources" element={
            <Suspense fallback={<LoadingFallback />}>
              <SimpleResources />
            </Suspense>
          } />
          <Route path="calendar" element={
            <Suspense fallback={<LoadingFallback />}>
              <Calendar />
            </Suspense>
          } />
          <Route path="reports" element={
            <Suspense fallback={<LoadingFallback />}>
              <Reports />
            </Suspense>
          } />
          <Route path="hr-admin" element={
            <Suspense fallback={<LoadingFallback />}>
              <HRAdmin />
            </Suspense>
          } />
          <Route path="settings" element={
            <Suspense fallback={<LoadingFallback />}>
              <Settings />
            </Suspense>
          } />
          <Route path="profile" element={
            <Suspense fallback={<LoadingFallback />}>
              <Profile />
            </Suspense>
          } />
          <Route path="team-supervision" element={
            <Suspense fallback={<LoadingFallback />}>
              <TeamSupervision />
            </Suspense>
          } />
        </Route>
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;