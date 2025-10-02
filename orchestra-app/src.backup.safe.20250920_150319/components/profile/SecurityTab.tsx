import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Grid
} from '@mui/material';
import {
  Security as SecurityIcon,
  Password as PasswordIcon,
  Devices as DevicesIcon,
  History as HistoryIcon,
  Shield as ShieldIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { User } from '../../types';
import { PasswordChangeModal } from './PasswordChangeModal';

interface SecurityTabProps {
  user: User;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ user }) => {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [lastPasswordChange] = useState<Date | null>(null); // À implémenter via Firebase

  // Simuler des sessions actives (à remplacer par de vraies données Firebase)
  const activeSessions = [
    {
      id: '1',
      device: 'Chrome sur Windows',
      location: 'Paris, France',
      lastActivity: new Date(),
      current: true
    },
    {
      id: '2',
      device: 'Mobile Safari',
      location: 'Paris, France',
      lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
      current: false
    }
  ];

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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Section Mot de Passe */}
        <Box>
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

        {/* Section Sécurité Générale */}
        <Box>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShieldIcon />
                Statut Sécurité
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Email vérifié"
                    secondary="Votre adresse email est vérifiée"
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    {user.isActive ? <CheckIcon color="success" /> : <WarningIcon color="warning" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Compte actif"
                    secondary={user.isActive ? "Votre compte est actif" : "Compte désactivé"}
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <WarningIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Authentification à deux facteurs"
                    secondary="Non configurée (fonctionnalité à venir)"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Box>

        {/* Section Sessions Actives */}
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DevicesIcon />
                Sessions Actives
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Gérez vos sessions actives sur différents appareils
              </Typography>

              <List>
                {activeSessions.map((session, index) => (
                  <React.Fragment key={session.id}>
                    <ListItem>
                      <ListItemIcon>
                        <DevicesIcon color={session.current ? 'primary' : 'inherit'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {session.device}
                            {session.current && (
                              <Chip label="Session actuelle" size="small" color="primary" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              📍 {session.location}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              🕒 Dernière activité: {session.lastActivity.toLocaleString('fr-FR')}
                            </Typography>
                          </Box>
                        }
                      />
                      {!session.current && (
                        <ListItemSecondaryAction>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => {
                              // Logique de déconnexion à implémenter
                              console.log('Déconnexion session:', session.id);
                            }}
                          >
                            Déconnecter
                          </Button>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                    {index < activeSessions.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />

              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={() => {
                  // Logique de déconnexion de toutes les sessions sauf l'actuelle
                  if (window.confirm('Êtes-vous sûr de vouloir déconnecter toutes les autres sessions ?')) {
                    console.log('Déconnexion de toutes les sessions');
                  }
                }}
              >
                Déconnecter toutes les autres sessions
              </Button>
            </CardContent>
          </Card>
        </Box>

        {/* Section Historique de Sécurité */}
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HistoryIcon />
                Activité Récente
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Suivez l'activité récente de votre compte
              </Typography>

              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Connexion réussie"
                    secondary={`${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} depuis Paris, France`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Profil mis à jour"
                    secondary={`${user.updatedAt ? new Date(user.updatedAt).toLocaleDateString('fr-FR') : 'Date inconnue'} - Informations personnelles`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Compte créé"
                    secondary={`${new Date(user.createdAt).toLocaleDateString('fr-FR')} - Bienvenue sur Orchestra !`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Box>
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