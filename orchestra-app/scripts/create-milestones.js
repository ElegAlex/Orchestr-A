const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, connectFirestoreEmulator } = require('firebase/firestore');

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

async function createMilestones() {
  console.log('🎯 Création des jalons de démonstration...');

  const milestones = [
    {
      projectId: 'project-1',
      name: 'Analyse et Conception',
      description: 'Phase d\'analyse des besoins et de conception technique',
      type: 'checkpoint',
      status: 'completed',
      startDate: new Date('2024-01-15'),
      dueDate: new Date('2024-02-29'),
      isKeyDate: true,
      successCriteria: [
        'Cahier des charges validé',
        'Architecture technique approuvée',
        'Équipe constituée'
      ],
      ownerId: '6FQ0CtcCI1G6Q5kaWVgc7eAcDdxb', // Admin
      reviewers: ['lxRCzdewnOeAO5leGCS4bGHi2up9'], // Manager
      impact: 'high',
      color: '#4caf50',
      showOnRoadmap: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '6FQ0CtcCI1G6Q5kaWVgc7eAcDdxb'
    },
    {
      projectId: 'project-1',
      name: 'Développement Core',
      description: 'Développement des fonctionnalités principales du système GED',
      type: 'delivery',
      status: 'in_progress',
      startDate: new Date('2024-03-01'),
      dueDate: new Date('2024-05-31'),
      isKeyDate: true,
      successCriteria: [
        'Module de recherche fonctionnel',
        'Interface utilisateur finalisée',
        'Tests unitaires validés'
      ],
      ownerId: 'blkx6yrkqA1H1jq5fweGr2cug0RJ', // Dev
      reviewers: ['lxRCzdewnOeAO5leGCS4bGHi2up9'], // Manager
      impact: 'critical',
      color: '#ff9800',
      showOnRoadmap: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'lxRCzdewnOeAO5leGCS4bGHi2up9'
    },
    {
      projectId: 'project-1',
      name: 'Tests et Déploiement',
      description: 'Phase de tests intégrés et mise en production',
      type: 'release',
      status: 'upcoming',
      startDate: new Date('2024-06-01'),
      dueDate: new Date('2024-06-30'),
      isKeyDate: true,
      successCriteria: [
        'Tests d\'intégration réussis',
        'Formation utilisateurs effectuée',
        'Mise en production validée'
      ],
      ownerId: 'lxRCzdewnOeAO5leGCS4bGHi2up9', // Manager
      reviewers: ['6FQ0CtcCI1G6Q5kaWVgc7eAcDdxb'], // Admin
      impact: 'critical',
      color: '#2196f3',
      showOnRoadmap: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'lxRCzdewnOeAO5leGCS4bGHi2up9'
    },
    {
      projectId: 'project-2',
      name: 'Audit UX/UI',
      description: 'Analyse complète de l\'expérience utilisateur actuelle',
      type: 'review',
      status: 'upcoming',
      startDate: new Date('2024-03-01'),
      dueDate: new Date('2024-03-31'),
      isKeyDate: false,
      successCriteria: [
        'Rapport d\'audit UX livré',
        'Recommendations documentées',
        'Maquettes wireframes créées'
      ],
      ownerId: 'lxRCzdewnOeAO5leGCS4bGHi2up9', // Manager
      reviewers: ['6FQ0CtcCI1G6Q5kaWVgc7eAcDdxb'], // Admin
      impact: 'medium',
      color: '#9c27b0',
      showOnRoadmap: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '6FQ0CtcCI1G6Q5kaWVgc7eAcDdxb'
    }
  ];

  try {
    for (const milestone of milestones) {
      await addDoc(collection(db, 'milestones'), milestone);
      console.log(`✅ Jalon créé: ${milestone.name} (${milestone.projectId})`);
    }

    console.log('🎉 Jalons créés avec succès !');
    console.log('📊 Vous pouvez maintenant tester la vue par jalons');

  } catch (error) {
    console.error('❌ Erreur lors de la création des jalons:', error);
  }
}

// Exécuter le script
createMilestones().then(() => {
  console.log('✅ Script terminé');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});