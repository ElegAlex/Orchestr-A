import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDM4x12OPV7YgzWSCYW-JOo8P0FjcegMr0",
  authDomain: "orchestr-a-3b48e.firebaseapp.com",
  projectId: "orchestr-a-3b48e",
  storageBucket: "orchestr-a-3b48e.firebasestorage.app",
  messagingSenderId: "727625651545",
  appId: "1:727625651545:web:bcfec2aff94934c73f6848"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const createTestProjects = async () => {
  const testProjects = [
    {
      name: "Modernisation du SI RH",
      code: "MOD-SI-RH-001",
      description: "Refonte complète du système d'information RH pour améliorer l'efficacité des processus",
      status: "active",
      priority: "P1",
      category: "IT",
      progress: 45,
      budget: 250000,
      spentBudget: 112500,
      startDate: Timestamp.fromDate(new Date("2024-01-15")),
      dueDate: Timestamp.fromDate(new Date("2025-06-30")),
      projectManager: "manager@orchestr-a.fr",
      sponsor: "DRH",
      methodology: "agile",
      teamMembers: [
        {
          userId: "user1",
          role: "Chef de projet",
          allocationPercentage: 80,
          startDate: Timestamp.fromDate(new Date("2024-01-15"))
        },
        {
          userId: "user2", 
          role: "Développeur",
          allocationPercentage: 100,
          startDate: Timestamp.fromDate(new Date("2024-02-01"))
        }
      ],
      tags: ["RH", "Modernisation", "SI"],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    },
    {
      name: "Déploiement Office 365",
      code: "DEPLOY-O365-002",
      description: "Migration et déploiement de la suite Office 365 pour tous les services",
      status: "planning",
      priority: "P2", 
      category: "IT",
      progress: 15,
      budget: 150000,
      spentBudget: 22500,
      startDate: Timestamp.fromDate(new Date("2024-03-01")),
      dueDate: Timestamp.fromDate(new Date("2024-12-31")),
      projectManager: "manager@orchestr-a.fr",
      sponsor: "DSI",
      methodology: "waterfall",
      teamMembers: [
        {
          userId: "user3",
          role: "Chef de projet technique",
          allocationPercentage: 60,
          startDate: Timestamp.fromDate(new Date("2024-03-01"))
        }
      ],
      tags: ["Office 365", "Migration", "Productivité"],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    },
    {
      name: "Refonte Site Web Institutionnel",
      code: "WEB-REFONTE-003",
      description: "Refonte complète du site web institutionnel avec mise aux normes accessibilité",
      status: "completed",
      priority: "P2",
      category: "Other",
      progress: 100,
      budget: 80000,
      spentBudget: 78500,
      startDate: Timestamp.fromDate(new Date("2023-09-01")),
      dueDate: Timestamp.fromDate(new Date("2024-02-29")),
      actualDueDate: Timestamp.fromDate(new Date("2024-02-15")),
      projectManager: "manager@orchestr-a.fr",
      sponsor: "Direction Communication",
      methodology: "agile",
      teamMembers: [
        {
          userId: "user4",
          role: "Chef de projet web",
          allocationPercentage: 50,
          startDate: Timestamp.fromDate(new Date("2023-09-01"))
        }
      ],
      tags: ["Web", "Accessibilité", "Communication"],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    }
  ];

  try {
    console.log("🚀 Création des projets de test...");
    
    for (const project of testProjects) {
      const docRef = await addDoc(collection(db, "projects"), project);
      console.log(`✅ Projet créé: ${project.name} (ID: ${docRef.id})`);
    }
    
    console.log("🎉 Tous les projets de test ont été créés avec succès !");
    console.log("Vous pouvez maintenant tester l'application.");
    
  } catch (error) {
    console.error("❌ Erreur lors de la création des projets:", error);
  }
};

createTestProjects();