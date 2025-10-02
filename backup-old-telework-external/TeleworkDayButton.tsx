import React, { useState } from 'react';
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material';
import {
  Home as HomeIcon,
  Business as OfficeIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { TeleworkDay } from '../../services/telework-calendar.service';

interface TeleworkDayButtonProps {
  userId: string;
  date: Date;
  teleworkDay: TeleworkDay | null;
  onToggle: (userId: string, date: Date) => Promise<void>;
  onRemove: (userId: string, date: Date) => Promise<void>;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

export const TeleworkDayButton: React.FC<TeleworkDayButtonProps> = ({
  userId,
  date,
  teleworkDay,
  onToggle,
  onRemove,
  disabled = false,
  size = 'small'
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);

  const isRemote = teleworkDay?.isRemote || false;
  const hasCustomSetting = teleworkDay !== null;

  const handleClick = async (event: React.MouseEvent) => {
    // Clic simple = toggle
    if (!disabled && !loading) {
      setLoading(true);
      try {
        await onToggle(userId, date);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleRemove = async () => {
    if (!loading) {
      setLoading(true);
      try {
        await onRemove(userId, date);
      } finally {
        setLoading(false);
      }
    }
    handleMenuClose();
  };

  const getTooltipText = () => {
    if (!hasCustomSetting) {
      return 'Cliquer pour définir le télétravail';
    }

    const sourceText = teleworkDay.source === 'weekly_pattern'
      ? 'Pattern hebdo'
      : teleworkDay.source === 'user_override'
      ? 'Personnalisé'
      : 'Admin';

    return `${isRemote ? 'Télétravail' : 'Bureau'} (${sourceText})`;
  };

  const getButtonColor = () => {
    if (!hasCustomSetting) return 'default';
    return isRemote ? 'primary' : 'secondary';
  };

  const getIcon = () => {
    if (loading) return <MoreIcon fontSize={size} />;
    return isRemote ? <HomeIcon fontSize={size} /> : <OfficeIcon fontSize={size} />;
  };

  return (
    <>
      <Tooltip title={getTooltipText()} arrow>
        <span>
          <IconButton
            onClick={handleClick}
            onContextMenu={handleMenuClick}
            disabled={disabled || loading}
            color={getButtonColor()}
            size={size}
            sx={{
              opacity: hasCustomSetting ? 1 : 0.6,
              '&:hover': {
                opacity: 1
              }
            }}
          >
            {getIcon()}
          </IconButton>
        </span>
      </Tooltip>

      {/* Menu contextuel pour actions avancées */}
      {hasCustomSetting && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem onClick={handleClick}>
            <ListItemIcon>
              {isRemote ? <OfficeIcon fontSize="small" /> : <HomeIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText>
              Basculer vers {isRemote ? 'Bureau' : 'Télétravail'}
            </ListItemText>
          </MenuItem>

          <MenuItem onClick={handleRemove}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              Supprimer (retour défaut)
            </ListItemText>
          </MenuItem>
        </Menu>
      )}

      {/* Chip pour indiquer la source */}
      {hasCustomSetting && teleworkDay.source === 'weekly_pattern' && (
        <Chip
          label="Pattern"
          size="small"
          variant="outlined"
          sx={{
            position: 'absolute',
            bottom: -8,
            right: -8,
            fontSize: '0.6rem',
            height: 16
          }}
        />
      )}
    </>
  );
};