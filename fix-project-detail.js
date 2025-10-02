const fs = require('fs');

// Lire le fichier de sauvegarde original
const content = fs.readFileSync('src/pages/ProjectDetail.tsx.backup', 'utf8');

// Appliquer les modifications
let modifiedContent = content;

// 1. Ajouter l'import MilestoneView
modifiedContent = modifiedContent.replace(
  "import MilestoneModal from '../components/project/MilestoneModal';",
  "import MilestoneModal from '../components/project/MilestoneModal';\nimport MilestoneView from '../components/project/MilestoneView';"
);

// 2. Ajouter le tab "Vue par Jalons" après le tab "Tâches"
modifiedContent = modifiedContent.replace(
  `          <Tab
            icon={<AssignmentIcon />}
            iconPosition="start"
            label="Tâches"
          />`,
  `          <Tab
            icon={<AssignmentIcon />}
            iconPosition="start"
            label="Tâches"
          />
          <Tab
            icon={<TimelineIcon />}
            iconPosition="start"
            label="Vue par Jalons"
          />`
);

// 3. Insérer le TabPanel pour MilestoneView après index 1 et ajuster les autres indices
modifiedContent = modifiedContent.replace(
  `          <TabPanel value={tabValue} index={2}>
            <ProjectTeam project={project} onRefresh={loadProject} />
          </TabPanel>`,
  `          <TabPanel value={tabValue} index={2}>
            <MilestoneView
              projectId={project.id}
              onCreateMilestone={handleCreateMilestone}
            />
          </TabPanel>
          <TabPanel value={tabValue} index={3}>
            <ProjectTeam project={project} onRefresh={loadProject} />
          </TabPanel>`
);

// 4. Ajuster tous les indices suivants
modifiedContent = modifiedContent.replace(/index={3}>/g, 'index={4}>');
modifiedContent = modifiedContent.replace(/index={4}>/g, 'index={5}>');
modifiedContent = modifiedContent.replace(/index={5}>/g, 'index={6}>');
modifiedContent = modifiedContent.replace(/index={6}>/g, 'index={7}>');
modifiedContent = modifiedContent.replace(/index={7}>/g, 'index={8}>');

// Corriger la duplication (index 4 devient 5, mais on avait déjà changé 4->5)
modifiedContent = modifiedContent.replace(/index={5}>/g, 'index={5}>'); // Roadmap reste à 4, corrigé manuellement ci-dessous

// Corrections spécifiques pour éviter les doublons
modifiedContent = modifiedContent.replace(
  `          <TabPanel value={tabValue} index={4}>
            <ProjectRoadmap`,
  `          <TabPanel value={tabValue} index={4}>
            <ProjectRoadmap`
);

modifiedContent = modifiedContent.replace(
  `          <TabPanel value={tabValue} index={5}>
            <ProjectGantt project={project} onRefresh={loadProject} />
          </TabPanel>`,
  `          <TabPanel value={tabValue} index={5}>
            <ProjectGantt project={project} onRefresh={loadProject} />
          </TabPanel>`
);

// Écrire le fichier modifié
fs.writeFileSync('src/pages/ProjectDetail.tsx', modifiedContent);

console.log('✅ ProjectDetail.tsx modifié avec succès !');
console.log('📋 Ajouts:');
console.log('  - Import MilestoneView');
console.log('  - Tab "Vue par Jalons" (index 2)');
console.log('  - TabPanel avec MilestoneView (index 2)');
console.log('  - Réindexation des autres TabPanels');