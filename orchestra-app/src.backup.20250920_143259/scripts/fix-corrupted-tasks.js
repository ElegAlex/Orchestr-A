#!/usr/bin/env node

/**
 * Script de réparation des tâches corrompues
 * Usage: node src/scripts/fix-corrupted-tasks.js
 */

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Configuration Firebase (utilise les variables d'env ou service account)
if (!admin.apps.length) {
  initializeApp({
    projectId: 'orchestr-a-3b48e'
  });
}

const db = getFirestore();

async function findCorruptedTasks() {
  console.log('🔍 Recherche des tâches corrompues...');
  
  const tasksSnapshot = await db.collection('tasks').get();
  const corruptedTasks = [];
  const validTasks = [];
  
  tasksSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const id = doc.id;
    
    // Vérifier les critères de corruption
    if (!id || id.trim() === '' || id === 'undefined' || id === 'null') {
      corruptedTasks.push({ 
        docId: id,
        data,
        issue: 'ID invalide ou manquant'
      });
    } else if (!data.title || !data.projectId) {
      corruptedTasks.push({
        docId: id,
        data,
        issue: 'Données essentielles manquantes'
      });
    } else if (data.createdAt && !data.createdAt.toDate) {
      corruptedTasks.push({
        docId: id,
        data,
        issue: 'Format de date incorrect'
      });
    } else {
      validTasks.push({ docId: id, data });
    }
  });
  
  console.log(`📊 Résultats du diagnostic:`);
  console.log(`  ✅ Tâches valides: ${validTasks.length}`);
  console.log(`  ❌ Tâches corrompues: ${corruptedTasks.length}`);
  
  if (corruptedTasks.length > 0) {
    console.log(`\n🔧 Tâches corrompues détectées:`);
    corruptedTasks.forEach((task, index) => {
      console.log(`  ${index + 1}. ID: "${task.docId}" - Problème: ${task.issue}`);
      console.log(`     Titre: "${task.data.title || 'MANQUANT'}"`);
      console.log(`     Projet: "${task.data.projectId || 'MANQUANT'}"`);
    });
  }
  
  return { corruptedTasks, validTasks };
}

async function fixCorruptedTasks(corruptedTasks) {
  console.log('\n🛠️ Réparation des tâches corrompues...');
  
  const batch = db.batch();
  let fixed = 0;
  let deleted = 0;
  
  for (const task of corruptedTasks) {
    if (!task.data.title || !task.data.projectId) {
      // Tâche irrécupérable - suppression
      console.log(`🗑️ Suppression de la tâche irrécupérable: ${task.docId}`);
      batch.delete(db.collection('tasks').doc(task.docId));
      deleted++;
    } else if (task.docId === 'undefined' || task.docId === 'null' || !task.docId.trim()) {
      // Créer une nouvelle tâche avec un ID valide
      const newDocRef = db.collection('tasks').doc();
      const fixedData = {
        ...task.data,
        id: newDocRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        repairedAt: admin.firestore.FieldValue.serverTimestamp(),
        originalCorruptedId: task.docId
      };
      
      console.log(`🔧 Création d'une nouvelle tâche pour: "${task.data.title}" (nouvel ID: ${newDocRef.id})`);
      batch.set(newDocRef, fixedData);
      
      // Supprimer l'ancienne version corrompue
      batch.delete(db.collection('tasks').doc(task.docId));
      fixed++;
    } else {
      // Réparer les données manquantes
      const fixedData = {
        ...task.data,
        id: task.docId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        repairedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Réparer les dates si nécessaire
      if (task.data.createdAt && !task.data.createdAt.toDate) {
        fixedData.createdAt = new Date(task.data.createdAt);
      }
      
      console.log(`🔧 Réparation de la tâche: "${task.data.title}" (ID: ${task.docId})`);
      batch.update(db.collection('tasks').doc(task.docId), fixedData);
      fixed++;
    }
  }
  
  if (fixed > 0 || deleted > 0) {
    await batch.commit();
    console.log(`\n✅ Réparation terminée:`);
    console.log(`  🔧 Tâches réparées: ${fixed}`);
    console.log(`  🗑️ Tâches supprimées: ${deleted}`);
  } else {
    console.log('\n✅ Aucune réparation nécessaire.');
  }
}

async function listAllTasksForDebug() {
  console.log('\n📋 Liste de toutes les tâches (debug):');
  const tasksSnapshot = await db.collection('tasks').get();
  
  tasksSnapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`${index + 1}. ID: "${doc.id}" | Titre: "${data.title || 'MANQUANT'}" | Projet: "${data.projectId || 'MANQUANT'}"`);
  });
}

// Interface en ligne de commande
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'diagnose';
  
  try {
    switch (command) {
      case 'diagnose':
        const { corruptedTasks } = await findCorruptedTasks();
        if (corruptedTasks.length === 0) {
          console.log('🎉 Aucune tâche corrompue détectée !');
        }
        break;
        
      case 'fix':
        const { corruptedTasks: tasksToFix } = await findCorruptedTasks();
        if (tasksToFix.length > 0) {
          console.log(`\n⚠️ ATTENTION: Cette opération va modifier/supprimer ${tasksToFix.length} tâches.`);
          console.log('Pour confirmer, relancez avec: node src/scripts/fix-corrupted-tasks.js fix-confirm');
        } else {
          console.log('🎉 Aucune tâche à réparer !');
        }
        break;
        
      case 'fix-confirm':
        const { corruptedTasks: tasksToFixConfirm } = await findCorruptedTasks();
        if (tasksToFixConfirm.length > 0) {
          await fixCorruptedTasks(tasksToFixConfirm);
        }
        break;
        
      case 'list':
        await listAllTasksForDebug();
        break;
        
      default:
        console.log(`Usage: node ${__filename} [diagnose|fix|fix-confirm|list]`);
        console.log(`  diagnose     - Diagnostiquer les tâches corrompues`);
        console.log(`  fix          - Prévisualiser les réparations`);
        console.log(`  fix-confirm  - Exécuter les réparations`);
        console.log(`  list         - Lister toutes les tâches (debug)`);
    }
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { findCorruptedTasks, fixCorruptedTasks };