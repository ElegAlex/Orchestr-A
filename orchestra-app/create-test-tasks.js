const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, where, connectFirestoreEmulator } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAY2INRLTXf_jsOocbX0iaJF653sGtApBU",
  authDomain: "orchestr-a.firebaseapp.com",
  projectId: "orchestr-a-3b48e",
  storageBucket: "orchestr-a-3b48e.firebasestorage.app",
  messagingSenderId: "991388913696",
  appId: "1:991388913696:web:2cc37a45fbae9871c6ac45",
  measurementId: "G-B58VR5VGT4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Connexion à l'emulator
connectFirestoreEmulator(db, "localhost", 8080);

async function createTestTasks() {
  console.log('🔨 Création de tâches de test pour la roadmap...');

  try {
    // D'abord, récupérer les jalons existants
    const milestonesQuery = query(collection(db, 'milestones'), where('projectId', '==', 'project-1'));
    const milestonesSnapshot = await getDocs(milestonesQuery);

    if (milestonesSnapshot.empty) {
      console.log('❌ Aucun jalon trouvé pour project-1');
      return;
    }

    const milestones = [];
    milestonesSnapshot.forEach(doc => {
      milestones.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📌 Jalons trouvés: ${milestones.length}`);
    milestones.forEach(m => console.log(`  - ${m.name} (${m.id})`));

    // Créer des tâches pour chaque jalon
    const tasks = [];

    // Jalon 1: Analyse et Conception
    if (milestones[0]) {
      tasks.push({
        projectId: 'project-1',
        milestoneId: milestones[0].id,
        title: 'Analyser les besoins client',
        description: 'Réunions avec les stakeholders pour définir les exigences',
        status: 'DONE',
        priority: 'high',
        type: 'task',
        responsible: ['6FQ0CtcCI1G6Q5kaWVgc7eAcDdxb'],
        estimatedHours: 16,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '6FQ0CtcCI1G6Q5kaWVgc7eAcDdxb'
      });

      tasks.push({
        projectId: 'project-1',
        milestoneId: milestones[0].id,
        title: 'Concevoir l\'architecture technique',
        description: 'Définir l\'architecture logicielle et les technologies',
        status: 'DONE',
        priority: 'high',
        type: 'task',
        responsible: ['blkx6yrkqA1H1jq5fweGr2cug0RJ'],
        estimatedHours: 24,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'lxRCzdewnOeAO5leGCS4bGHi2up9'
      });

      tasks.push({
        projectId: 'project-1',
        milestoneId: milestones[0].id,
        title: 'Rédiger le cahier des charges',
        description: 'Documentation complète des spécifications',
        status: 'DONE',
        priority: 'medium',
        type: 'task',
        responsible: ['lxRCzdewnOeAO5leGCS4bGHi2up9'],
        estimatedHours: 12,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '6FQ0CtcCI1G6Q5kaWVgc7eAcDdxb'
      });
    }

    // Jalon 2: Développement Core
    if (milestones[1]) {
      tasks.push({
        projectId: 'project-1',
        milestoneId: milestones[1].id,
        title: 'Développer le module de recherche',
        description: 'Implémentation de l\'indexation et recherche full-text',
        status: 'IN_PROGRESS',
        priority: 'critical',
        type: 'task',
        responsible: ['blkx6yrkqA1H1jq5fweGr2cug0RJ'],
        estimatedHours: 40,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'lxRCzdewnOeAO5leGCS4bGHi2up9'
      });

      tasks.push({
        projectId: 'project-1',
        milestoneId: milestones[1].id,
        title: 'Créer l\'interface utilisateur',
        description: 'Développement du frontend React avec Material-UI',
        status: 'IN_PROGRESS',
        priority: 'high',
        type: 'task',
        responsible: ['blkx6yrkqA1H1jq5fweGr2cug0RJ'],
        estimatedHours: 32,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'lxRCzdewnOeAO5leGCS4bGHi2up9'
      });

      tasks.push({
        projectId: 'project-1',
        milestoneId: milestones[1].id,
        title: 'Écrire les tests unitaires',
        description: 'Tests Jest et React Testing Library',
        status: 'TODO',
        priority: 'medium',
        type: 'task',
        responsible: ['blkx6yrkqA1H1jq5fweGr2cug0RJ'],
        estimatedHours: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'lxRCzdewnOeAO5leGCS4bGHi2up9'
      });
    }

    // Jalon 3: Tests et Déploiement
    if (milestones[2]) {
      tasks.push({
        projectId: 'project-1',
        milestoneId: milestones[2].id,
        title: 'Tests d\'intégration',
        description: 'Tests end-to-end avec Cypress',
        status: 'TODO',
        priority: 'high',
        type: 'task',
        responsible: ['lxRCzdewnOeAO5leGCS4bGHi2up9'],
        estimatedHours: 16,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'lxRCzdewnOeAO5leGCS4bGHi2up9'
      });

      tasks.push({
        projectId: 'project-1',
        milestoneId: milestones[2].id,
        title: 'Formation des utilisateurs',
        description: 'Sessions de formation et documentation utilisateur',
        status: 'TODO',
        priority: 'medium',
        type: 'task',
        responsible: ['6FQ0CtcCI1G6Q5kaWVgc7eAcDdxb'],
        estimatedHours: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'lxRCzdewnOeAO5leGCS4bGHi2up9'
      });

      tasks.push({
        projectId: 'project-1',
        milestoneId: milestones[2].id,
        title: 'Déploiement en production',
        description: 'Mise en production et monitoring',
        status: 'TODO',
        priority: 'critical',
        type: 'task',
        responsible: ['blkx6yrkqA1H1jq5fweGr2cug0RJ'],
        estimatedHours: 12,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'lxRCzdewnOeAO5leGCS4bGHi2up9'
      });
    }

    // Créer les tâches dans Firestore
    console.log(`🔨 Création de ${tasks.length} tâches...`);

    for (const task of tasks) {
      const docRef = await addDoc(collection(db, 'tasks'), task);
      console.log(`✅ Tâche créée: "${task.title}" (${docRef.id}) pour jalon ${task.milestoneId}`);
    }

    console.log('🎉 Tâches de test créées avec succès !');
    console.log('📊 Vous pouvez maintenant tester la vue roadmap avec les tâches');

  } catch (error) {
    console.error('❌ Erreur lors de la création des tâches:', error);
  }
}

// Exécuter le script
createTestTasks().then(() => {
  console.log('✅ Script terminé');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});