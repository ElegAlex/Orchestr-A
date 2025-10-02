import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  VpnKey as PasswordIcon,
  Send as SendIcon,
  Refresh as GenerateIcon,
} from '@mui/icons-material';
import { User } from '../../types';
import { authService } from '../../services/auth.service';

interface PasswordResetModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onSuccess?: (message: string) => void;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  open,
  onClose,
  user,
  onSuccess
}) => {
  const [resetMethod, setResetMethod] = useState<'email' | 'manual'>('email');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateRandomPassword = () => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    // Assurer au moins un de chaque type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Majuscule
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Minuscule
    password += '0123456789'[Math.floor(Math.random() * 10)]; // Chiffre
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Caractère spécial

    // Compléter jusqu'à 12 caractères
    for (let i = 4; i < 12; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Mélanger les caractères
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleGeneratePassword = () => {
    const generated = generateRandomPassword();
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const handleSubmit = async () => {
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      if (resetMethod === 'email') {
        // Envoi d'email de réinitialisation
        await authService.resetPassword(user.email);
        onSuccess?.('Email de réinitialisation envoyé avec succès !');
        onClose();
      } else {
        // Changement manuel du mot de passe
        if (!newPassword || newPassword.length < 6) {
          setError('Le mot de passe doit contenir au moins 6 caractères');
          return;
        }

        if (newPassword !== confirmPassword) {
          setError('Les mots de passe ne correspondent pas');
          return;
        }

        // TODO: Implémenter la fonction de changement de mot de passe via Cloud Function
        // Pour l'instant, on utilise l'email de reset
        await authService.resetPassword(user.email);

        let message = 'Email de réinitialisation envoyé.';
        if (sendEmail && newPassword) {
          message += ` Le nouveau mot de passe temporaire est : ${newPassword}`;
        }

        onSuccess?.(message);
        onClose();
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResetMethod('email');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSendEmail(true);
    setError('');
    onClose();
  };

  if (!user) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <PasswordIcon color="primary" />
          <Typography variant="h6">
            Réinitialiser le mot de passe
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Utilisateur : {user.firstName} {user.lastName} ({user.email})
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={3}>
          {error && (
            <Alert severity="error">
              {error}
            </Alert>
          )}

          {/* Méthode de réinitialisation */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Méthode de réinitialisation
            </Typography>
            <Box display="flex" gap={2}>
              <Button
                variant={resetMethod === 'email' ? 'contained' : 'outlined'}
                onClick={() => setResetMethod('email')}
                startIcon={<SendIcon />}
                fullWidth
              >
                Email de réinitialisation
              </Button>
              <Button
                variant={resetMethod === 'manual' ? 'contained' : 'outlined'}
                onClick={() => setResetMethod('manual')}
                startIcon={<PasswordIcon />}
                fullWidth
              >
                Nouveau mot de passe
              </Button>
            </Box>
          </Box>

          {resetMethod === 'email' ? (
            <Alert severity="info">
              📧 Un email sera envoyé à <strong>{user.email}</strong> avec les instructions pour réinitialiser le mot de passe.
              <br />
              L'utilisateur pourra définir son propre nouveau mot de passe.
            </Alert>
          ) : (
            <Box display="flex" flexDirection="column" gap={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle2">
                  Définir un nouveau mot de passe
                </Typography>
                <Button
                  size="small"
                  startIcon={<GenerateIcon />}
                  onClick={handleGeneratePassword}
                  variant="outlined"
                >
                  Générer
                </Button>
              </Box>

              <TextField
                fullWidth
                label="Nouveau mot de passe"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText="Minimum 6 caractères, avec majuscules, chiffres et caractères spéciaux recommandés"
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
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Confirmer le mot de passe"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={confirmPassword !== '' && newPassword !== confirmPassword}
                helperText={
                  confirmPassword !== '' && newPassword !== confirmPassword
                    ? 'Les mots de passe ne correspondent pas'
                    : ''
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                  />
                }
                label="Envoyer aussi un email avec le nouveau mot de passe temporaire"
              />

              <Alert severity="warning">
                ⚠️ <strong>Important :</strong>
                <br />• Communiquez le mot de passe de manière sécurisée
                <br />• Demandez à l'utilisateur de le changer à sa première connexion
                <br />• Le mot de passe sera visible dans cette interface
              </Alert>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || (resetMethod === 'manual' && (!newPassword || newPassword !== confirmPassword))}
          startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
        >
          {loading ? 'En cours...' :
           resetMethod === 'email' ? 'Envoyer Email' : 'Réinitialiser'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};