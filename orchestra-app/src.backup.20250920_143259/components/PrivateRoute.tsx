import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { CircularProgress, Box } from '@mui/material';
import { auth } from '../config/firebase';

interface PrivateRouteProps {
  children: React.ReactElement;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const location = useLocation();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Attendre que Firebase vérifie l'état d'authentification
    const unsubscribe = auth.onAuthStateChanged((user) => {
      // Donner un petit délai pour que Redux se synchronise
      setTimeout(() => {
        setCheckingAuth(false);
      }, 100);
    });

    return () => unsubscribe();
  }, []);

  // Pendant la vérification, afficher un loader
  if (checkingAuth) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};