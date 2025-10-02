import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Badge,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';
import {
  Home as RemoteIcon,
  Business as OfficeIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  CheckCircle as ApprovedIcon,
  Schedule as PendingIcon,
  Group as TeamIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import {
  TeleworkDayResolution,
  TeleworkMode,
  MODE_ICONS,
  MODE_LABELS,
  SOURCE_LABELS
} from '../../types/telework.types';

interface TeleworkDayCellProps {
  resolution: TeleworkDayResolution;
  isEditable: boolean;
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
  onModeChange: (mode: TeleworkMode) => Promise<void>;
  onRequestOverride: (mode: TeleworkMode, reason?: string) => Promise<void>;
  onConfigureProfile: () => void;
  onViewDetails: () => void;
}

export const TeleworkDayCell: React.FC<TeleworkDayCellProps> = ({
  resolution,
  isEditable,
  size = 'medium',
  showDetails = true,
  onModeChange,
  onRequestOverride,
  onConfigureProfile,
  onViewDetails
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);

  const {
    resolvedMode,
    source,
    confidence,
    conflicts,
    warnings,
    appliedRules
  } = resolution;

  // =============================================
  // STYLES ET APPARENCE
  // =============================================

  const getModeColor = () => {
    switch (resolvedMode) {
      case 'remote': return 'primary';
      case 'office': return 'secondary';
      default: return 'default';
    }
  };

  const getModeIcon = () => {
    if (resolvedMode === 'remote') {
      return <RemoteIcon fontSize={size} sx={{ color: '#2196f3' }} />;
    } else {
      return <OfficeIcon fontSize={size} sx={{ color: '#9e9e9e' }} />;
    }
  };

  const getConfidenceColor = () => {
    if (confidence >= 90) return '#4caf50'; // Vert
    if (confidence >= 80) return '#ff9800'; // Orange
    return '#f44336'; // Rouge
  };

  const hasIssues = conflicts.length > 0 || warnings.length > 0;
  const hasCriticalIssues = conflicts.some(c => c.severity === 'error');
  const isPending = appliedRules.override?.approvalStatus === 'pending';

  // =============================================
  // INTERACTIONS
  // =============================================

  const handleMainClick = async () => {
    if (!isEditable || loading) return;

    // Clic simple = toggle entre bureau et télétravail
    const newMode = resolvedMode === 'remote' ? 'office' : 'remote';

    setLoading(true);
    try {
      await onModeChange(newMode);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleQuickOverride = async (mode: TeleworkMode) => {
    setLoading(true);
    try {
      await onRequestOverride(mode);
    } finally {
      setLoading(false);
    }
    handleMenuClose();
  };

  const handleDetailsClick = () => {
    onViewDetails();
    handleMenuClose();
  };

  const handleConfigureClick = () => {
    onConfigureProfile();
    handleMenuClose();
  };

  // =============================================
  // TOOLTIP CONTENT
  // =============================================

  const getTooltipContent = () => {
    const modeLabel = MODE_LABELS[resolvedMode];
    const sourceLabel = SOURCE_LABELS[source];

    let content = `${modeLabel} (${sourceLabel})`;

    if (confidence < 100) {
      content += ` - Confiance: ${confidence}%`;
    }

    if (isPending) {
      content += ' - En attente d\'approbation';
    }

    if (hasIssues) {
      content += ` - ${conflicts.length} conflit(s), ${warnings.length} avertissement(s)`;
    }

    return content;
  };

  // =============================================
  // RENDER
  // =============================================

  const renderMainButton = () => (
    <Tooltip title={`${resolvedMode === 'remote' ? 'Télétravail' : 'Bureau'} - Cliquer pour changer`} arrow placement="top">
      <span>
        <IconButton
          onClick={handleMainClick}
          disabled={!isEditable || loading}
          size={size}
          sx={{
            borderRadius: '50%',
            backgroundColor: resolvedMode === 'remote' ? '#e3f2fd' : '#f5f5f5',
            border: resolvedMode === 'remote' ? '2px solid #2196f3' : '2px solid #9e9e9e',
            '&:hover': {
              backgroundColor: resolvedMode === 'remote' ? '#bbdefb' : '#eeeeee',
              transform: 'scale(1.05)'
            },
            '&:disabled': {
              opacity: 0.5
            }
          }}
        >
          {loading ? (
            <CircularProgress size={size === 'small' ? 16 : 24} />
          ) : (
            getModeIcon()
          )}
        </IconButton>
      </span>
    </Tooltip>
  );

  const renderActionMenu = () => (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={handleMenuClose}
      onClick={(e) => e.stopPropagation()}
      PaperProps={{
        sx: { minWidth: 200 }
      }}
    >
      {/* Actions rapides */}
      <MenuItem onClick={() => handleQuickOverride('office')}>
        <ListItemIcon>
          <OfficeIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Bureau ce jour</ListItemText>
      </MenuItem>

      <MenuItem onClick={() => handleQuickOverride('remote')}>
        <ListItemIcon>
          <RemoteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Télétravail ce jour</ListItemText>
      </MenuItem>

      {/* Actions de configuration */}
      <MenuItem onClick={handleConfigureClick}>
        <ListItemIcon>
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Modifier mes règles</ListItemText>
      </MenuItem>

      {/* Détails */}
      <MenuItem onClick={handleDetailsClick}>
        <ListItemIcon>
          <MoreIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Voir les détails</ListItemText>
      </MenuItem>
    </Menu>
  );

  const renderDetails = () => {
    if (!showDetails || size === 'small') return null;

    return (
      <Box sx={{ mt: 0.5, textAlign: 'center' }}>
        {isPending && (
          <Chip
            label="En attente"
            size="small"
            color="warning"
            sx={{ fontSize: '0.7rem', height: 18 }}
          />
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        p: 0.5,
        minHeight: size === 'large' ? 80 : size === 'medium' ? 60 : 40
      }}
    >
      {/* Bouton principal */}
      {renderMainButton()}


      {renderActionMenu()}

      {/* Détails et indicateurs */}
      {renderDetails()}
    </Box>
  );
};

export default TeleworkDayCell;