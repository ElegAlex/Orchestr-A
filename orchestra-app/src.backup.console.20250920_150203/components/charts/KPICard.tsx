import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  TrendingFlat as TrendStableIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { KPIMetric } from '../../services/analytics.service';

// =======================================================================================
// TYPES & INTERFACES
// =======================================================================================

interface KPICardProps {
  metric: KPIMetric;
  size?: 'small' | 'medium' | 'large';
  showTrend?: boolean;
  showProgress?: boolean;
  onClick?: () => void;
}

// =======================================================================================
// COMPOSANT PRINCIPAL
// =======================================================================================

export const KPICard: React.FC<KPICardProps> = ({
  metric,
  size = 'medium',
  showTrend = true,
  showProgress = true,
  onClick
}) => {
  /**
   * Obtenir l'icône de tendance
   */
  const getTrendIcon = () => {
    switch (metric.trend) {
      case 'up':
        return <TrendUpIcon color="success" fontSize="small" />;
      case 'down':
        return <TrendDownIcon color="error" fontSize="small" />;
      case 'stable':
      default:
        return <TrendStableIcon color="action" fontSize="small" />;
    }
  };

  /**
   * Obtenir la couleur de la tendance
   */
  const getTrendColor = () => {
    switch (metric.trend) {
      case 'up':
        return 'success.main';
      case 'down':
        return 'error.main';
      case 'stable':
      default:
        return 'text.secondary';
    }
  };

  /**
   * Formater la valeur selon l'unité
   */
  const formatValue = (value: number) => {
    const unit = metric.unit || '';
    
    switch (unit) {
      case '%':
        return `${Math.round(value)}%`;
      case '€':
      case 'currency':
        return new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'EUR'
        }).format(value);
      case 'time':
        return `${Math.round(value)}h`;
      default:
        return Math.round(value).toLocaleString('fr-FR');
    }
  };

  /**
   * Calculer le pourcentage de progression vers l'objectif
   */
  const getProgressPercentage = () => {
    if (!metric.target) return 0;
    return Math.min((metric.value / metric.target) * 100, 100);
  };

  /**
   * Obtenir la couleur de progression selon les seuils
   */
  const getProgressColor = () => {
    if (!metric.threshold) return 'primary';
    
    if (metric.value <= metric.threshold.critical) {
      return 'error';
    } else if (metric.value <= metric.threshold.warning) {
      return 'warning';
    } else {
      return 'success';
    }
  };

  /**
   * Déterminer la hauteur de la carte selon la taille
   */
  const getCardHeight = () => {
    switch (size) {
      case 'small':
        return 120;
      case 'large':
        return 200;
      case 'medium':
      default:
        return 160;
    }
  };

  return (
    <Card
      sx={{
        height: getCardHeight(),
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: 4
        } : undefined
      }}
      onClick={onClick}
    >
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* En-tête avec nom et info */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Typography
            variant={size === 'small' ? 'body2' : 'h6'}
            color="text.secondary"
            sx={{
              fontWeight: 500,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {metric.name}
          </Typography>
          
          <Tooltip title={`Catégorie: ${metric.category}`}>
            <IconButton size="small" sx={{ opacity: 0.7 }}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Valeur principale */}
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography
            variant={size === 'small' ? 'h5' : size === 'large' ? 'h3' : 'h4'}
            color="text.primary"
            sx={{ fontWeight: 'bold', lineHeight: 1 }}
          >
            {formatValue(metric.value)}
          </Typography>
          
          {showTrend && metric.trendPercentage !== undefined && (
            <Chip
              icon={getTrendIcon()}
              label={`${Math.abs(metric.trendPercentage).toFixed(1)}%`}
              size="small"
              variant="outlined"
              sx={{
                color: getTrendColor(),
                borderColor: getTrendColor(),
                '& .MuiChip-icon': {
                  color: 'inherit'
                }
              }}
            />
          )}
        </Box>

        {/* Barre de progression vers l'objectif */}
        {showProgress && metric.target && (
          <Box sx={{ mt: 'auto' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography variant="caption" color="text.secondary">
                Objectif: {formatValue(metric.target)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round(getProgressPercentage())}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getProgressPercentage()}
              color={getProgressColor()}
              sx={{ height: 6, borderRadius: 1 }}
            />
          </Box>
        )}

        {/* Seuils d'alerte */}
        {metric.threshold && (
          <Box display="flex" gap={1} mt={1}>
            <Chip
              label="Critique"
              size="small"
              color={metric.value <= metric.threshold.critical ? 'error' : 'default'}
              variant={metric.value <= metric.threshold.critical ? 'filled' : 'outlined'}
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
            <Chip
              label="Attention"
              size="small"
              color={metric.value <= metric.threshold.warning ? 'warning' : 'default'}
              variant={metric.value <= metric.threshold.warning ? 'filled' : 'outlined'}
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default KPICard;