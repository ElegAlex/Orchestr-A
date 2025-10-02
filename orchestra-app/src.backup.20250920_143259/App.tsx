import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
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
import DashboardHub from './pages/DashboardHub';
import { Projects } from './pages/Projects';
import { ProjectCreate } from './pages/ProjectCreate';
import ProjectDetail from './pages/ProjectDetail';
import { ProjectEdit } from './pages/ProjectEdit';
import { Tasks } from './pages/Tasks';
import SimpleResources from './pages/SimpleResources';
import Resources from './pages/Resources';
import Calendar from './pages/Calendar';
import { MyLeaves } from './pages/MyLeaves';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import HRAdmin from './pages/HRAdmin';
import { HRDashboard } from './pages/HRDashboard';
import { Settings } from './pages/Settings';
import Profile from './pages/Profile';

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
          <Route path="dashboard-hub" element={<DashboardHub />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/create" element={<ProjectCreate />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="projects/:projectId/edit" element={<ProjectEdit />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="resources" element={<Resources />} />
          <Route path="simple-resources" element={<SimpleResources />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="my-leaves" element={<MyLeaves />} />
          <Route path="reports" element={<Reports />} />
          <Route path="admin" element={<Admin />} />
          <Route path="hr-admin" element={<HRAdmin />} />
          <Route path="hr-dashboard" element={<HRDashboard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
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