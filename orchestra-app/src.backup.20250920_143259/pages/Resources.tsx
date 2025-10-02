import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  useTheme
} from '@mui/material';
import {
  People as PeopleIcon,
  AccountTree as MatrixIcon,
  Analytics as AnalyticsIcon,
  Warning as GapsIcon,
  Groups as TeamBuilderIcon,
} from '@mui/icons-material';
import { TeamManagementTab } from '../components/resources/TeamManagementTab';
import { SkillsMatrixTab } from '../components/resources/SkillsMatrixTab';
import { AnalyticsTab } from '../components/resources/AnalyticsTab';
import { SkillsGapsTab } from '../components/resources/SkillsGapsTab';
import { TeamBuilderTab } from '../components/resources/TeamBuilderTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`resources-tabpanel-${index}`}
      aria-labelledby={`resources-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `resources-tab-${index}`,
    'aria-controls': `resources-tabpanel-${index}`,
  };
}

const Resources: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const tabs = [
    {
      label: 'Équipe',
      icon: <PeopleIcon />,
      component: <TeamManagementTab />,
      description: 'Gestion des profils et compétences individuelles'
    },
    {
      label: 'Skills Matrix',
      icon: <MatrixIcon />,
      component: <SkillsMatrixTab />,
      description: 'Matrice interactive des compétences par personne'
    },
    {
      label: 'Analytics',
      icon: <AnalyticsIcon />,
      component: <AnalyticsTab />,
      description: 'Tableaux de bord et métriques RH'
    },
    {
      label: 'Skills Gaps',
      icon: <GapsIcon />,
      component: <SkillsGapsTab />,
      description: 'Analyse des lacunes et recommandations'
    },
    {
      label: 'Team Builder',
      icon: <TeamBuilderIcon />,
      component: <TeamBuilderTab />,
      description: 'Outil d\'affectation optimale des équipes'
    }
  ];

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Ressources Humaines
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Gestion complète des talents, compétences et affectations d'équipe
        </Typography>
      </Box>

      {/* Tabs Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTabs-flexContainer': {
              gap: 1
            }
          }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={index}
              icon={tab.icon}
              label={tab.label}
              {...a11yProps(index)}
              sx={{
                minHeight: 72,
                textTransform: 'none',
                fontSize: '0.95rem',
                fontWeight: 500,
                '&.Mui-selected': {
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}15, ${theme.palette.secondary.main}15)`,
                  borderRadius: '8px 8px 0 0',
                }
              }}
            />
          ))}
        </Tabs>

        {/* Tab Description */}
        <Box sx={{ px: 3, py: 1.5, bgcolor: 'grey.50', borderRadius: '0 0 8px 8px' }}>
          <Typography variant="body2" color="text.secondary">
            📋 {tabs[tabValue]?.description}
          </Typography>
        </Box>
      </Paper>

      {/* Tab Content */}
      {tabs.map((tab, index) => (
        <TabPanel key={index} value={tabValue} index={index}>
          {tab.component}
        </TabPanel>
      ))}
    </Box>
  );
};

export default Resources;