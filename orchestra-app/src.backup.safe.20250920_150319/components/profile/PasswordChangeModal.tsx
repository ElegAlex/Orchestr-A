import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { profileService, PasswordChangeData } from '../../services/profile.service';

interface PasswordChangeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PasswordStrength {
  score: number;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    special: boolean;
  };
}

export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState<PasswordChangeData & { confirmPassword: string }>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const getPasswordStrength = (password: string): PasswordStrength => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    const score = Object.values(checks).filter(Boolean).length;

    return { score, checks };
  };

  const passwordStrength = getPasswordStrength(formData.newPassword);

  const getStrengthLabel = (score: number): { label: string; color: string } => {
    if (score <= 1) return { label: 'Très faible', color: '#f44336' };
    if (score <= 2) return { label: 'Faible', color: '#ff9800' };
    if (score <= 3) return { label: 'Moyen', color: '#ffeb3b' };
    if (score <= 4) return { label: 'Fort', color: '#8bc34a' };
    return { label: 'Très fort', color: '#4caf50' };
  };

  const strengthInfo = getStrengthLabel(passwordStrength.score);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!formData.currentPassword) {
      setError('Veuillez saisir votre mot de passe actuel');
      return;
    }

    if (!formData.newPassword) {
      setError('Veuillez saisir un nouveau mot de passe');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordStrength.score < 3) {
      setError('Le nouveau mot de passe doit être plus sécurisé');
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError('Le nouveau mot de passe doit être différent du mot de passe actuel');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await profileService.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });

      onSuccess();
      handleReset();

    } catch (error: any) {
      setError(error.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setError(null);
    setShowPasswords({
      current: false,
      new: false,
      confirm: false
    });
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const togglePasswordVisibility = (field: keyof typeof showPasswords) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon />
          Changer le mot de passe
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ mb: 3 }}>
            <TextField
              label="Mot de passe actuel"
              type={showPasswords.current ? 'text' : 'password'}
              value={formData.currentPassword}
              onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
              disabled={loading}
              fullWidth
              required
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => togglePasswordVisibility('current')}
                      edge="end"
                    >
                      {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <TextField
              label="Nouveau mot de passe"
              type={showPasswords.new ? 'text' : 'password'}
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              disabled={loading}
              fullWidth
              required
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => togglePasswordVisibility('new')}
                      edge="end"
                    >
                      {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <TextField
              label="Confirmer le nouveau mot de passe"
              type={showPasswords.confirm ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              disabled={loading}
              fullWidth
              required
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => togglePasswordVisibility('confirm')}
                      edge="end"
                    >
                      {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Box>

          {/* Indicateur de force du mot de passe */}
          {formData.newPassword && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">
                  Force du mot de passe
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: strengthInfo.color, fontWeight: 'bold' }}
                >
                  {strengthInfo.label}
                </Typography>
              </Box>

              <LinearProgress
                variant="determinate"
                value={(passwordStrength.score / 5) * 100}
                sx={{
                  mb: 2,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: strengthInfo.color
                  }
                }}
              />

              <List dense>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {passwordStrength.checks.length ? (
                      <CheckIcon sx={{ fontSize: 20, color: 'success.main' }} />
                    ) : (
                      <CancelIcon sx={{ fontSize: 20, color: 'error.main' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="Au moins 8 caractères"
                    sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {passwordStrength.checks.uppercase ? (
                      <CheckIcon sx={{ fontSize: 20, color: 'success.main' }} />
                    ) : (
                      <CancelIcon sx={{ fontSize: 20, color: 'error.main' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="Au moins une majuscule"
                    sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {passwordStrength.checks.lowercase ? (
                      <CheckIcon sx={{ fontSize: 20, color: 'success.main' }} />
                    ) : (
                      <CancelIcon sx={{ fontSize: 20, color: 'error.main' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="Au moins une minuscule"
                    sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {passwordStrength.checks.numbers ? (
                      <CheckIcon sx={{ fontSize: 20, color: 'success.main' }} />
                    ) : (
                      <CancelIcon sx={{ fontSize: 20, color: 'error.main' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="Au moins un chiffre"
                    sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {passwordStrength.checks.special ? (
                      <CheckIcon sx={{ fontSize: 20, color: 'success.main' }} />
                    ) : (
                      <CancelIcon sx={{ fontSize: 20, color: 'error.main' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="Au moins un caractère spécial"
                    sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' } }}
                  />
                </ListItem>
              </List>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || passwordStrength.score < 3}
          >
            {loading ? 'Changement...' : 'Changer le mot de passe'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};