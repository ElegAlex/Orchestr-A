#!/usr/bin/env node
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Script pour créer des données de test et valider le fonctionnement
 */

const PROJECT_ID = 'orchestr-a';

async function createTestProject() {
  console.log('📊 Création d\'un projet de test...');
  
  const projectData = {
    fields: {
      code: { stringValue: "TEST-PROJECT" },
      name: { stringValue: "Projet Test" },
      description: { stringValue: "Projet créé automatiquement pour tester l'application" },
      status: { stringValue: "active" },
      priority: { stringValue: "P1" },
      startDate: { timestampValue: new Date().toISOString() },
      endDate: { timestampValue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }, // +30 jours
      progress: { integerValue: "0" },
      sponsor: { stringValue: "System" },
      projectManager: { stringValue: "admin" },
      teamMembers: { arrayValue: { values: [] } },
      tags: { arrayValue: { values: [] } },
      category: { stringValue: "IT" },
      methodology: { stringValue: "agile" },
      createdAt: { timestampValue: new Date().toISOString() },
      updatedAt: { timestampValue: new Date().toISOString() }
    }
  };
  
  try {
    const { stdout } = await execAsync(`curl -s -X POST \\
      -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
      -H "Content-Type: application/json" \\
      -d '${JSON.stringify(projectData)}' \\
      "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/projects"`);
    
    const response = JSON.parse(stdout);
    if (response.error) {
      throw new Error(`Erreur création projet: ${response.error.message}`);
    }
    
    // Extraire l'ID du projet créé
    const projectId = response.name.split('/').pop();
    console.log('✅ Projet test créé:', projectId);
    return projectId;
    
  } catch (error) {
    console.log('❌ Erreur création projet:', error.message);
    return null;
  }
}

async function createTestTasks(projectId) {
  console.log('📋 Création de tâches de test...');
  
  const tasks = [
    {
      title: "Analyse des besoins",
      description: "Analyser les besoins fonctionnels du projet",
      type: "STORY",
      status: "DONE",
      priority: "P1",
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // -10 jours
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // -5 jours
    },
    {
      title: "Développement Frontend",
      description: "Développer l'interface utilisateur",
      type: "TASK",
      status: "IN_PROGRESS", 
      priority: "P1",
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // -3 jours
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 jours
    },
    {
      title: "Tests utilisateur",
      description: "Effectuer les tests d'acceptation utilisateur",
      type: "TASK",
      status: "TODO",
      priority: "P2",
      startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // +5 jours
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // +15 jours
    },
    {
      title: "Déploiement",
      description: "Déployer l'application en production",
      type: "TASK",
      status: "BLOCKED",
      priority: "P0",
      startDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // +12 jours
      dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // +20 jours
    }
  ];
  
  let createdCount = 0;
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    
    const taskData = {
      fields: {
        projectId: { stringValue: projectId },
        title: { stringValue: task.title },
        description: { stringValue: task.description },
        type: { stringValue: task.type },
        status: { stringValue: task.status },
        priority: { stringValue: task.priority },
        startDate: { timestampValue: task.startDate.toISOString() },
        dueDate: { timestampValue: task.dueDate.toISOString() },
        reporterId: { stringValue: "system" },
        dependencies: { arrayValue: { values: [] } },
        labels: { arrayValue: { values: [] } },
        attachments: { arrayValue: { values: [] } },
        comments: { arrayValue: { values: [] } },
        createdAt: { timestampValue: new Date().toISOString() },
        updatedAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: "system" }
      }
    };
    
    try {
      const { stdout } = await execAsync(`curl -s -X POST \\
        -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
        -H "Content-Type: application/json" \\
        -d '${JSON.stringify(taskData)}' \\
        "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tasks"`);
      
      const response = JSON.parse(stdout);
      if (response.error) {
        console.log(`❌ Erreur tâche ${i + 1}: ${response.error.message}`);
      } else {
        const taskId = response.name.split('/').pop();
        console.log(`✅ Tâche ${i + 1} créée: ${task.title} (${taskId.slice(0, 8)}...)`);
        createdCount++;
      }
      
    } catch (error) {
      console.log(`❌ Erreur tâche ${i + 1}:`, error.message);
    }
    
    // Pause entre les créations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`✅ ${createdCount}/${tasks.length} tâches créées`);
  return createdCount > 0;
}

async function testTaskQueries(projectId) {
  console.log('🧪 Test des requêtes sur les tâches...');
  
  // Test de la requête qui causait l'erreur
  const query = {
    structuredQuery: {
      from: [{ collectionId: "tasks" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "projectId" },
          op: "EQUAL",
          value: { stringValue: projectId }
        }
      },
      orderBy: [
        { field: { fieldPath: "createdAt" }, direction: "ASCENDING" }
      ]
    }
  };
  
  try {
    const { stdout, stderr } = await execAsync(`curl -s -X POST \\
      -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
      -H "Content-Type: application/json" \\
      -d '${JSON.stringify(query)}' \\
      "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery"`);
    
    if (stderr && stderr.includes('index')) {
      console.log('❌ Requête échoue encore - index pas encore propagé');
      return false;
    }
    
    const response = JSON.parse(stdout);
    if (response.error) {
      console.log('❌ Erreur requête:', response.error.message);
      return false;
    }
    
    const tasks = response.filter(r => r.document).length;
    console.log(`✅ Requête réussie - ${tasks} tâches trouvées`);
    return true;
    
  } catch (error) {
    console.log('❌ Erreur test requête:', error.message);
    return false;
  }
}

async function main() {
  console.log('🎯 Création de données de test pour validation');
  console.log('=============================================');
  console.log('');
  
  // Créer un projet de test
  const projectId = await createTestProject();
  if (!projectId) {
    console.log('❌ Impossible de créer le projet de test');
    process.exit(1);
  }
  
  console.log('');
  
  // Créer des tâches de test
  const tasksCreated = await createTestTasks(projectId);
  if (!tasksCreated) {
    console.log('❌ Aucune tâche de test créée');
    process.exit(1);
  }
  
  console.log('');
  
  // Attendre un peu pour la propagation
  console.log('⏳ Attente de la propagation des données (5s)...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Tester les requêtes
  const queriesWork = await testTaskQueries(projectId);
  
  console.log('');
  console.log('🎉 RÉSUMÉ:');
  console.log(`✅ Projet créé: ${projectId}`);
  console.log(`✅ Tâches créées: ${tasksCreated ? 'OUI' : 'NON'}`);
  console.log(`✅ Requêtes OK: ${queriesWork ? 'OUI' : 'NON'}`);
  
  if (projectId && tasksCreated && queriesWork) {
    console.log('');
    console.log('🚀 DONNÉES DE TEST PRÊTES!');
    console.log('');
    console.log('🌐 Pour tester l\'application:');
    console.log('1. Ouvrir https://orchestr-a.web.app');
    console.log('2. Aller dans "Projets"');
    console.log('3. Cliquer sur "Projet Test"');
    console.log('4. Cliquer sur l\'onglet "Tâches"');
    console.log('5. Vérifier que les tâches se chargent sans erreur');
    console.log('');
    console.log('📊 Les tâches devraient montrer:');
    console.log('   - "Analyse des besoins" (terminée)');
    console.log('   - "Développement Frontend" (en cours)'); 
    console.log('   - "Tests utilisateur" (à faire)');
    console.log('   - "Déploiement" (bloquée)');
  } else {
    console.log('');
    console.log('❌ PROBLÈME DÉTECTÉ');
    console.log('🔧 L\'index n\'est peut-être pas encore propagé');
    console.log('⏳ Attendez 2-3 minutes et testez manuellement l\'application');
  }
}

if (require.main === module) {
  main().catch(console.error);
}