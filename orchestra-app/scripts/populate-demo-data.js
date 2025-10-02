const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, setDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAY2INRLTXf_jsOocbX0iaJF653sGtApBU",
  authDomain: "orchestr-a.firebaseapp.com",
  projectId: "orchestr-a-3b48e",
  storageBucket: "orchestr-a.firebasestorage.app",
  messagingSenderId: "991388913696",
  appId: "1:991388913696:web:2cc37a45fbae9871c6ac45",
  measurementId: "G-B58VR5VGT4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function populateDemoData() {
  console.log('🚀 Initialisation des données de démonstration...');

  try {
    // Créer des utilisateurs de démonstration
    const users = [
      {
        id: 'demo-user-1',
        email: 'admin@orchestra-demo.com',
        displayName: 'Admin Orchestra',
        firstName: 'Admin',
        lastName: 'Orchestra',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        avatar: 'https://via.placeholder.com/150/007bff/ffffff?text=AO'
      },
      {
        id: 'demo-user-2',
        email: 'manager@orchestra-demo.com',
        displayName: 'Marie Dupont',
        firstName: 'Marie',
        lastName: 'Dupont',
        role: 'project_manager',
        isActive: true,
        createdAt: new Date(),
        avatar: 'https://via.placeholder.com/150/28a745/ffffff?text=MD'
      },
      {
        id: 'demo-user-3',
        email: 'dev@orchestra-demo.com',
        displayName: 'Jean Martin',
        firstName: 'Jean',
        lastName: 'Martin',
        role: 'contributor',
        isActive: true,
        createdAt: new Date(),
        avatar: 'https://via.placeholder.com/150/ffc107/ffffff?text=JM'
      }
    ];

    for (const user of users) {
      await setDoc(doc(db, 'users', user.id), user);
      console.log(`✅ Utilisateur créé: ${user.displayName}`);
    }

    // Créer des projets de démonstration
    const projects = [
      {
        id: 'project-1',
        name: 'Système de Gestion Documentaire',
        description: 'Mise en place d\'un système de gestion électronique des documents pour l\'administration',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-06-30'),
        budget: 250000,
        createdBy: 'demo-user-2',
        teamMembers: ['demo-user-1', 'demo-user-2', 'demo-user-3'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'project-2',
        name: 'Modernisation Portail Citoyen',
        description: 'Refonte complète du portail citoyen avec nouvelles fonctionnalités e-services',
        status: 'PLANNING',
        priority: 'MEDIUM',
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-12-31'),
        budget: 180000,
        createdBy: 'demo-user-2',
        teamMembers: ['demo-user-2', 'demo-user-3'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const project of projects) {
      await setDoc(doc(db, 'projects', project.id), project);
      console.log(`✅ Projet créé: ${project.name}`);
    }

    // Créer des tâches de démonstration
    const tasks = [
      {
        title: 'Analyse des besoins fonctionnels',
        description: 'Recueil et analyse des besoins fonctionnels auprès des utilisateurs',
        type: 'STORY',
        status: 'DONE',
        priority: 'P1',
        projectId: 'project-1',
        assignedTo: 'demo-user-2',
        createdBy: 'demo-user-1',
        estimatedHours: 40,
        loggedHours: 42,
        startDate: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Conception de l\'architecture technique',
        description: 'Définition de l\'architecture technique du système de GED',
        type: 'TASK',
        status: 'IN_PROGRESS',
        priority: 'P1',
        projectId: 'project-1',
        assignedTo: 'demo-user-3',
        createdBy: 'demo-user-2',
        estimatedHours: 60,
        loggedHours: 25,
        startDate: new Date('2024-02-01'),
        dueDate: new Date('2024-03-15'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Développement module de recherche',
        description: 'Implémentation du moteur de recherche avancée dans les documents',
        type: 'TASK',
        status: 'TODO',
        priority: 'P2',
        projectId: 'project-1',
        assignedTo: 'demo-user-3',
        createdBy: 'demo-user-2',
        estimatedHours: 80,
        loggedHours: 0,
        startDate: new Date('2024-03-01'),
        dueDate: new Date('2024-04-30'),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Audit UX/UI du portail existant',
        description: 'Analyse de l\'expérience utilisateur et de l\'interface actuelle',
        type: 'STORY',
        status: 'TODO',
        priority: 'P1',
        projectId: 'project-2',
        assignedTo: 'demo-user-2',
        createdBy: 'demo-user-1',
        estimatedHours: 24,
        loggedHours: 0,
        startDate: new Date('2024-03-01'),
        dueDate: new Date('2024-03-31'),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const task of tasks) {
      await addDoc(collection(db, 'tasks'), task);
      console.log(`✅ Tâche créée: ${task.title}`);
    }

    // Créer des données RH de démonstration
    const leaveRequests = [
      {
        userId: 'demo-user-2',
        type: 'vacation',
        reason: 'Congés d\'été',
        startDate: new Date('2024-07-15'),
        endDate: new Date('2024-07-26'),
        workingDaysCount: 10,
        status: 'approved',
        requestedAt: new Date('2024-05-15'),
        approvedBy: 'demo-user-1',
        approvedAt: new Date('2024-05-16')
      },
      {
        userId: 'demo-user-3',
        type: 'training',
        reason: 'Formation React avancé',
        startDate: new Date('2024-06-10'),
        endDate: new Date('2024-06-14'),
        workingDaysCount: 5,
        status: 'pending',
        requestedAt: new Date('2024-05-20')
      }
    ];

    for (const request of leaveRequests) {
      await addDoc(collection(db, 'leaveRequests'), request);
      console.log(`✅ Demande de congé créée pour: ${request.userId}`);
    }

    // Créer des notifications de démonstration
    const notifications = [
      {
        userId: 'demo-user-2',
        type: 'task_assignment',
        title: 'Nouvelle tâche assignée',
        message: 'Une nouvelle tâche "Conception de l\'architecture" vous a été assignée',
        isRead: false,
        priority: 'medium',
        createdAt: new Date(),
        category: 'tasks'
      },
      {
        userId: 'demo-user-3',
        type: 'leave_approval',
        title: 'Demande de congé approuvée',
        message: 'Votre demande de formation du 10-14 juin a été approuvée',
        isRead: true,
        priority: 'low',
        createdAt: new Date(Date.now() - 86400000), // 1 jour avant
        category: 'hr'
      }
    ];

    for (const notification of notifications) {
      await addDoc(collection(db, 'notifications'), notification);
      console.log(`✅ Notification créée pour: ${notification.userId}`);
    }

    console.log('🎉 Données de démonstration créées avec succès !');
    console.log('📊 Application prête à être testée sur: https://orchestr-a-3b48e.web.app');

  } catch (error) {
    console.error('❌ Erreur lors de la création des données:', error);
  }
}

// Exécuter le script
populateDemoData();