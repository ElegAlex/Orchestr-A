import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Divider,
  Link
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Login as LoginIcon,
  Email as EmailIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { adminUserCreationService } from '../../services/admin-user-creation.service';
import { authService } from '../../services/auth.service';
import { User } from '../../types';

interface LoginWithUsernamePasswordProps {
  onLoginSuccess: (user: User) => void;
  onError: (error: string) => void;
  loading?: boolean;
}

export const LoginWithUsernamePassword: React.FC<LoginWithUsernamePasswordProps> = ({
  onLoginSuccess,
  onError,
  loading = false
}) => {
  const [loginMode, setLoginMode] = useState<'username' | 'email'>('username');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let user: User;
      
      if (loginMode === 'username') {
        // Connexion avec login/mot de passe
        if (!formData.username || !formData.password) {
          throw new Error('Login et mot de passe requis.');
        }
        user = await adminUserCreationService.signInWithLogin(formData.username, formData.password);
      } else {
        // Connexion avec email/mot de passe (méthode traditionnelle)
        if (!formData.email || !formData.password) {
          throw new Error('Email et mot de passe requis.');
        }
        user = await authService.signInWithEmail(formData.email, formData.password);
      }

      onLoginSuccess(user);
      
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur de connexion';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLoginMode = () => {
    setLoginMode(loginMode === 'username' ? 'email' : 'username');
    setError(null);
    setFormData({ username: '', email: '', password: '' });
  };

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 4, 
        maxWidth: 400, 
        mx: 'auto',
        mt: 4
      }}
    >
      <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
        <LoginIcon color="primary" sx={{ fontSize: 48 }} />
        
        <Typography variant="h4" component="h1" textAlign="center" gutterBottom>
          Orchestr'A
        </Typography>
        
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {loginMode === 'username' 
            ? 'Connectez-vous avec votre login'
            : 'Connectez-vous avec votre email'
          }
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
          {loginMode === 'username' ? (
            <TextField
              fullWidth
              label="Login"
              placeholder="nom_prenom"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              margin="normal"
              required
              autoComplete="username"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon />
                  </InputAdornment>
                )
              }}
            />
          ) : (
            <TextField
              fullWidth
              type="email"
              label="Email"
              placeholder="utilisateur@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              margin="normal"
              required
              autoComplete="email"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon />
                  </InputAdornment>
                )
              }}
            />
          )}

          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label="Mot de passe"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            margin="normal"
            required
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={isLoading || loading}
            sx={{ mt: 3, mb: 2 }}
          >
            {isLoading || loading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </Box>

        <Divider sx={{ width: '100%' }} />

        <Button
          variant="text"
          onClick={toggleLoginMode}
          disabled={isLoading || loading}
          sx={{ textTransform: 'none' }}
        >
          {loginMode === 'username' 
            ? 'Se connecter avec un email à la place'
            : 'Se connecter avec un login à la place'
          }
        </Button>

        <Typography variant="caption" color="text.secondary" textAlign="center">
          {loginMode === 'username' 
            ? 'Votre login vous a été fourni par votre administrateur'
            : 'Méthode de connexion traditionnelle par email'
          }
        </Typography>
      </Box>
    </Paper>
  );
};

export default LoginWithUsernamePassword;