import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert
} from '@mui/material';
import {
  Security as SecurityIcon,
  Password as PasswordIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { User } from '../../types';
import { PasswordChangeModal } from './PasswordChangeModal';

interface SecurityTabProps {
  user: User;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ user }) => {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [lastPasswordChange] = useState<Date | null>(null); // À implémenter via Firebase

  const handlePasswordChangeSuccess = () => {
    setPasswordModalOpen(false);
    // Optionnel: rafraîchir les données ou afficher une notification
  };

  const getPasswordStrengthStatus = () => {
    // Logique simplifiée - à améliorer avec de vraies métriques
    const hasRecentChange = lastPasswordChange &&
      (Date.now() - lastPasswordChange.getTime()) < (90 * 24 * 60 * 60 * 1000); // 90 jours

    return {
      isStrong: true, // À calculer selon les critères réels
      isRecent: hasRecentChange,
      daysOld: lastPasswordChange ?
        Math.floor((Date.now() - lastPasswordChange.getTime()) / (24 * 60 * 60 * 1000)) : null
    };
  };

  const passwordStatus = getPasswordStrengthStatus();

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SecurityIcon />
        Sécurité du Compte
      </Typography>

      {/* Section Mot de Passe uniquement */}
      <Box sx={{ maxWidth: 600 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PasswordIcon />
              Mot de Passe
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              {passwordStatus.isStrong ? (
                <CheckIcon color="success" />
              ) : (
                <WarningIcon color="warning" />
              )}
              <Box>
                <Typography variant="body1">
                  Mot de passe {passwordStatus.isStrong ? 'sécurisé' : 'faible'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {lastPasswordChange ?
                    `Modifié il y a ${passwordStatus.daysOld} jours` :
                    'Jamais modifié depuis cette interface'
                  }
                </Typography>
              </Box>
            </Box>

            {!passwordStatus.isRecent && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Nous recommandons de changer votre mot de passe tous les 90 jours.
              </Alert>
            )}

            <Button
              variant="contained"
              startIcon={<PasswordIcon />}
              onClick={() => setPasswordModalOpen(true)}
              fullWidth
            >
              Changer le mot de passe
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* Modal de changement de mot de passe */}
      <PasswordChangeModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={handlePasswordChangeSuccess}
      />
    </Box>
  );
};