import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import {
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  Divider,
  Paper,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import GoogleIcon from '@mui/icons-material/Google';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import { AppDispatch } from '../../store';
import { signInWithEmail, signInWithGoogle } from '../../store/slices/authSlice';
import { adminUserCreationService } from '../../services/admin-user-creation.service';

interface LoginFormData {
  loginOrEmail: string;
  password: string;
}

export const LoginForm: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    mode: 'onChange',
    defaultValues: {
      loginOrEmail: '',
      password: '',
    },
  });

  const handleSignIn = async (data: LoginFormData) => {
    setError('');
    setLoading(true);

    try {
      const { loginOrEmail, password } = data;

      console.log('🔐 Tentative de connexion avec:', { loginOrEmail });

      // Détecter si c'est un login interne ou un email externe
      if (loginOrEmail.includes('@orchestr-a.internal')) {
        console.log('🏢 Email interne détecté, extraction du login:', loginOrEmail);
        // Extraire le login de l'email interne
        const login = loginOrEmail.split('@')[0];
        console.log('👤 Connexion avec login extrait:', login);
        const user = await adminUserCreationService.signInWithLogin(login, password);
        console.log('✅ Utilisateur connecté:', user.displayName);
        // Mettre à jour le store Redux avec les données utilisateur
        const { setUser } = await import('../../store/slices/authSlice');
        const { store } = await import('../../store');
        store.dispatch(setUser(user));
      } else if (loginOrEmail.includes('@')) {
        console.log('📧 Connexion avec email externe:', loginOrEmail);
        // Connexion avec email classique
        await dispatch(signInWithEmail({ email: loginOrEmail, password })).unwrap();
      } else {
        console.log('👤 Connexion avec login interne:', loginOrEmail);
        // Connexion avec login interne
        const user = await adminUserCreationService.signInWithLogin(loginOrEmail, password);
        console.log('✅ Utilisateur connecté:', user.displayName);
        // Mettre à jour le store Redux avec les données utilisateur
        const { setUser } = await import('../../store/slices/authSlice');
        const { store } = await import('../../store');
        store.dispatch(setUser(user));
      }

      navigate('/dashboard-hub');
    } catch (err: any) {
      console.error('❌ Erreur de connexion:', err);
      setError(err.message || 'Échec de la connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      await dispatch(signInWithGoogle()).unwrap();
      navigate('/dashboard-hub');
    } catch (err: any) {
      if (err.message !== 'Redirection en cours...') {
        setError(err.message || 'Échec de la connexion avec Google');
      }
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
          borderRadius: 2,
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Orchestr'A
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Orchestration Agile
          </Typography>
        </Box>

        <Typography variant="h5" component="h2" sx={{ mb: 3 }}>
          Connexion
        </Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          📋 <strong>Compte requis</strong> - Seuls les utilisateurs autorisés peuvent se connecter.
          Les nouveaux comptes sont créés exclusivement par l'équipe administrative.
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit(handleSignIn)}>
          <Controller
            name="loginOrEmail"
            control={control}
            rules={{
              required: 'Le login ou email est requis',
              validate: (value) => {
                if (value.includes('@')) {
                  // Validation email
                  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
                  return emailRegex.test(value) || 'Format d\'email invalide';
                } else {
                  // Validation login
                  const loginRegex = /^[a-zA-Z0-9_]{3,50}$/;
                  return loginRegex.test(value) || 'Format de login invalide (lettres, chiffres, underscore)';
                }
              }
            }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Login ou Email"
                type="text"
                margin="normal"
                autoComplete="username"
                error={!!errors.loginOrEmail}
                helperText={errors.loginOrEmail?.message || 'Entrez votre login (ex: jean_dupont) ou email'}
                placeholder="jean_dupont ou user@example.com"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {field.value && field.value.includes('@') ? <EmailIcon /> : <PersonIcon />}
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />

          <Controller
            name="password"
            control={control}
            rules={{
              required: 'Le mot de passe est requis',
              minLength: {
                value: 6,
                message: 'Le mot de passe doit contenir au moins 6 caractères'
              }
            }}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                margin="normal"
                autoComplete="current-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />

          <Box sx={{ mt: 1, mb: 2, textAlign: 'right' }}>
            <Link
              to="/forgot-password"
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              Mot de passe oublié ?
            </Link>
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading || !isValid}
            sx={{
              mb: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            Se connecter
          </Button>
        </form>

        <Divider sx={{ my: 3 }}>OU</Divider>

        <Button
          fullWidth
          variant="outlined"
          size="large"
          startIcon={<GoogleIcon />}
          onClick={handleGoogleSignIn}
          disabled={loading}
          sx={{ mb: 2 }}
        >
          Se connecter avec Google
        </Button>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Besoin d'un compte ? Contactez votre administrateur pour obtenir vos identifiants.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};