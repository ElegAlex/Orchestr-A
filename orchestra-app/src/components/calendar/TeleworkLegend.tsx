import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Home as RemoteIcon,
  Business as OfficeIcon,
  Settings as PatternIcon,
  Edit as OverrideIcon,
  Group as TeamIcon,
  AdminPanelSettings as AdminIcon,
  Schedule as PendingIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import {
  MODE_LABELS,
  SOURCE_LABELS
} from '../../types/telework.types';

interface TeleworkLegendProps {
  compact?: boolean;
  showStats?: boolean;
  stats?: {
    totalUsers: number;
    remoteToday: number;
    officeToday: number;
    pendingApprovals: number;
    conflicts: number;
  };
}

export const TeleworkLegend: React.FC<TeleworkLegendProps> = ({
  compact = false,
  showStats = false,
  stats
}) => {

  // =============================================
  // DONNÉES DE LA LÉGENDE
  // =============================================

  const modeItems = [
    {
      icon: <OfficeIcon />,
      label: 'Bureau',
      description: 'Travail au bureau',
      color: 'default' as const
    },
    {
      icon: <RemoteIcon />,
      label: 'Télétravail',
      description: 'Travail à distance',
      color: 'primary' as const
    }
  ];

  const sourceItems = [
    {
      icon: <PatternIcon />,
      label: 'Planning type',
      description: 'Défini par le pattern hebdomadaire',
      color: 'info' as const
    },
    {
      icon: <OverrideIcon />,
      label: 'Exception',
      description: 'Demande ponctuelle approuvée',
      color: 'secondary' as const
    },
    {
      icon: <TeamIcon />,
      label: 'Règle équipe',
      description: 'Imposé par règle équipe/projet',
      color: 'warning' as const
    },
    {
      icon: <AdminIcon />,
      label: 'Admin',
      description: 'Imposé par administration',
      color: 'error' as const
    }
  ];

  const statusItems = [
    {
      icon: <ApprovedIcon />,
      label: 'Approuvé',
      description: 'Demande approuvée',
      color: 'success' as const
    },
    {
      icon: <PendingIcon />,
      label: 'En attente',
      description: 'Demande en attente d\'approbation',
      color: 'warning' as const
    },
    {
      icon: <RejectedIcon />,
      label: 'Rejeté',
      description: 'Demande rejetée',
      color: 'error' as const
    }
  ];

  const alertItems = [
    {
      icon: <InfoIcon />,
      label: 'Information',
      description: 'Information contextuelle',
      color: 'info' as const
    },
    {
      icon: <WarningIcon />,
      label: 'Avertissement',
      description: 'Attention requise',
      color: 'warning' as const
    },
    {
      icon: <ErrorIcon />,
      label: 'Erreur',
      description: 'Conflit ou violation',
      color: 'error' as const
    }
  ];

  // =============================================
  // RENDER HELPERS
  // =============================================

  const renderLegendItem = (item: any, size: 'small' | 'medium' = 'medium') => (
    <Box
      key={item.label}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: size === 'small' ? 0.5 : 1,
        minWidth: compact ? 'auto' : 150
      }}
    >
      <Box sx={{ color: `${item.color}.main`, display: 'flex' }}>
        {React.cloneElement(item.icon, {
          fontSize: size === 'small' ? 'small' : 'medium'
        })}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography
          variant={size === 'small' ? 'caption' : 'body2'}
          sx={{ fontWeight: 500 }}
        >
          {item.label}
        </Typography>
        {!compact && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            {item.description}
          </Typography>
        )}
      </Box>
    </Box>
  );

  const renderSection = (title: string, items: any[], columns: number = 2) => (
    <Box sx={{ mb: compact ? 1 : 2 }}>
      <Typography
        variant={compact ? 'caption' : 'subtitle2'}
        sx={{
          fontWeight: 600,
          mb: compact ? 0.5 : 1,
          color: 'text.secondary',
          textTransform: 'uppercase',
          fontSize: compact ? '0.7rem' : '0.8rem'
        }}
      >
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 0.5 : 1 }}>
        {items.map((item, index) => (
          <Box key={index} sx={{
            flex: columns === 2 ? '0 0 calc(50% - 4px)' : '0 0 calc(33.33% - 4px)',
            minWidth: 0
          }}>
            {renderLegendItem(item, compact ? 'small' : 'medium')}
          </Box>
        ))}
      </Box>
    </Box>
  );

  const renderStats = () => {
    if (!showStats || !stats) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Statistiques du jour
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            icon={<OfficeIcon />}
            label={`Bureau: ${stats.officeToday}`}
            size="small"
            color="default"
            variant="outlined"
          />
          <Chip
            icon={<RemoteIcon />}
            label={`Télétravail: ${stats.remoteToday}`}
            size="small"
            color="primary"
            variant="outlined"
          />
          {stats.pendingApprovals > 0 && (
            <Badge badgeContent={stats.pendingApprovals} color="warning">
              <Chip
                icon={<PendingIcon />}
                label="En attente"
                size="small"
                color="warning"
                variant="outlined"
              />
            </Badge>
          )}
          {stats.conflicts > 0 && (
            <Badge badgeContent={stats.conflicts} color="error">
              <Chip
                icon={<WarningIcon />}
                label="Conflits"
                size="small"
                color="error"
                variant="outlined"
              />
            </Badge>
          )}
        </Box>
      </Box>
    );
  };

  // =============================================
  // MAIN RENDER
  // =============================================

  if (compact) {
    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Légende télétravail
            </Typography>
            <Tooltip title="Aide sur les symboles et codes couleur">
              <IconButton size="small">
                <HelpIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {renderStats()}

          <Stack spacing={1}>
            {/* Modes principaux */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {modeItems.map(item => renderLegendItem(item, 'small'))}
            </Box>

            <Divider />

            {/* Sources principales */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {sourceItems.map(item => renderLegendItem(item, 'small'))}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6">
            Légende télétravail
          </Typography>
          <Tooltip title="Guide d'utilisation du système télétravail">
            <IconButton size="small">
              <HelpIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {renderStats()}

        {/* Modes de travail */}
        {renderSection('Modes de travail', modeItems, 2)}

        <Divider sx={{ my: 2 }} />

        {/* Sources des règles */}
        {renderSection('Sources des règles', sourceItems, 2)}

        <Divider sx={{ my: 2 }} />

        {/* Statuts d\'approbation */}
        {renderSection('Statuts d\'approbation', statusItems, 3)}

        <Divider sx={{ my: 2 }} />

        {/* Types d\'alertes */}
        {renderSection('Types d\'alertes', alertItems, 3)}

        {/* Aide rapide */}
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Actions rapides :</strong> Clic simple = basculer mode • Clic droit = menu •
            Icône ⚙️ = modifier planning type • Badges = conflits/alertes
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TeleworkLegend;