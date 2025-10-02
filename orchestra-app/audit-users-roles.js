const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'orchestr-a-3b48e'
  });
}

const db = getFirestore();

async function auditUsersRoles() {
  try {
    console.log('🔍 Audit de sécurité - Rôles des utilisateurs');
    console.log('='.repeat(50));

    const snapshot = await db.collection('users').get();

    if (snapshot.empty) {
      console.log('⚠️  Aucun utilisateur trouvé dans la base de données');
      return;
    }

    let adminCount = 0;
    let viewerCount = 0;
    let otherRoles = {};

    console.log(`📊 Total d'utilisateurs : ${snapshot.size}\n`);

    snapshot.forEach((doc) => {
      const userData = doc.data();
      const role = userData.role || 'undefined';

      // Compter par rôle
      if (role === 'admin') {
        adminCount++;
        console.log(`🔴 ADMIN: ${userData.displayName || userData.email || doc.id} (${userData.email})`);
      } else if (role === 'viewer') {
        viewerCount++;
        console.log(`👁️  VIEWER: ${userData.displayName || userData.email || doc.id} (${userData.email})`);
      } else {
        otherRoles[role] = (otherRoles[role] || 0) + 1;
        console.log(`🔵 ${role.toUpperCase()}: ${userData.displayName || userData.email || doc.id} (${userData.email})`);
      }
    });

    console.log('\n' + '='.repeat(50));
    console.log('📈 RÉSUMÉ DES RÔLES:');
    console.log(`🔴 Administrateurs: ${adminCount}`);
    console.log(`👁️  Viewers: ${viewerCount}`);

    Object.entries(otherRoles).forEach(([role, count]) => {
      console.log(`🔵 ${role}: ${count}`);
    });

    // Alertes de sécurité
    console.log('\n' + '🚨'.repeat(10));
    if (adminCount > 3) {
      console.log(`⚠️  ALERTE: ${adminCount} administrateurs (recommandé: 2-3 max)`);
    }

    if (viewerCount > snapshot.size * 0.7) {
      console.log(`✅ Bonne pratique: La majorité des utilisateurs ont le rôle 'viewer' par défaut`);
    }

    console.log('✅ Audit terminé avec succès');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur lors de l\'audit:', error);
    process.exit(1);
  }
}

auditUsersRoles();