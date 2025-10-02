import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

// Configuration CORS
const corsOptions = {
  origin: [
    'https://orchestr-a-3b48e.web.app',
    'https://orchestr-a-3b48e.firebaseapp.com',
    'http://localhost:3000'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'OPTIONS']
};

const corsHandler = cors(corsOptions);

export const updateUserLogin = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    // Handle CORS
    return corsHandler(req, res, async () => {
      try {
        // Only allow POST requests
        if (req.method !== 'POST') {
          res.status(405).send({ error: 'Method not allowed' });
          return;
        }

        // Verify Firebase token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(401).send({ error: 'Unauthorized: No valid token provided' });
          return;
        }

        const token = authHeader.split('Bearer ')[1];
        let decodedToken;
        
        try {
          decodedToken = await admin.auth().verifyIdToken(token);
        } catch (error) {
          console.error('Token verification failed:', error);
          res.status(401).send({ error: 'Unauthorized: Invalid token' });
          return;
        }

        // Check that the user is an admin
        const adminUser = await admin.firestore()
          .collection('users')
          .doc(decodedToken.uid)
          .get();
        
        if (!adminUser.exists || adminUser.data()?.role !== 'admin') {
          res.status(403).send({ error: 'Permission denied: Admin access required' });
          return;
        }

        const { userId, newLogin, newPassword } = req.body;

        // Validation
        if (!userId || !newLogin) {
          res.status(400).send({ 
            error: 'Données manquantes : userId et newLogin sont requis' 
          });
          return;
        }

        // Validate login format (lettres, chiffres et underscore)
        const loginRegex = /^[a-zA-Z0-9_]+$/;
        if (!loginRegex.test(newLogin)) {
          res.status(400).send({ 
            error: 'Le login doit contenir uniquement des lettres, chiffres et underscore' 
          });
          return;
        }

        // Generate new internal email
        const newEmail = `${newLogin}@orchestr-a.internal`;
        
        // LOGIQUE SIMPLIFIÉE : On modifie un utilisateur existant
        // Pas besoin de vérifier les conflits - on UPDATE son email
        
        console.log(`🔄 Modification de l'utilisateur ${userId}:`);
        console.log(`   Nouveau login: ${newLogin}`);
        console.log(`   Nouveau email: ${newEmail}`);

        try {
          // Get current user data from Firestore
          const userDoc = await admin.firestore()
            .collection('users')
            .doc(userId)
            .get();
          
          if (!userDoc.exists) {
            res.status(404).send({ error: 'Utilisateur non trouvé dans Firestore' });
            return;
          }

          const currentUserData = userDoc.data();
          const oldLogin = currentUserData?.login;
          const oldEmail = currentUserData?.email;

          // Si le login n'a pas changé, on peut juste mettre à jour Firestore
          if (oldLogin === newLogin) {
            console.log(`Le login n'a pas changé (${newLogin}), mise à jour Firestore uniquement`);
            
            // Mise à jour Firestore seulement (pas Firebase Auth)
            await admin.firestore()
              .collection('users')
              .doc(userId)
              .update({
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastModifiedBy: decodedToken.uid
              });

            // Optionnellement mettre à jour le mot de passe si fourni
            if (newPassword && newPassword.length >= 6) {
              await admin.auth().updateUser(userId, {
                password: newPassword
              });
            }

            res.status(200).json({
              success: true,
              message: `Utilisateur "${newLogin}" mis à jour avec succès (login inchangé)`,
              newLogin: newLogin,
              newEmail: newEmail
            });
            return;
          }

          // Update Firebase Auth
          const updateData: any = {
            email: newEmail
          };
          
          if (newPassword && newPassword.length >= 6) {
            updateData.password = newPassword;
          }

          await admin.auth().updateUser(userId, updateData);

          // Update Firestore
          await admin.firestore()
            .collection('users')
            .doc(userId)
            .update({
              login: newLogin,
              email: newEmail,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              lastModifiedBy: decodedToken.uid
            });

          // Log the change for audit
          await admin.firestore()
            .collection('audit_logs')
            .add({
              action: 'update_user_login',
              userId: userId,
              performedBy: decodedToken.uid,
              oldLogin: oldLogin,
              newLogin: newLogin,
              oldEmail: oldEmail,
              newEmail: newEmail,
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
          
          res.status(200).json({
            success: true,
            message: `Login mis à jour avec succès de "${oldLogin}" vers "${newLogin}"`,
            newLogin: newLogin,
            newEmail: newEmail
          });

        } catch (updateError: any) {
          console.error('Erreur lors de la mise à jour:', updateError);
          
          if (updateError.code === 'auth/email-already-exists') {
            res.status(409).send({ error: 'Cet email est déjà utilisé' });
          } else if (updateError.code === 'auth/invalid-email') {
            res.status(400).send({ error: 'Format d\'email invalide' });
          } else if (updateError.code === 'auth/invalid-password') {
            res.status(400).send({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
          } else {
            res.status(500).send({ error: 'Erreur lors de la mise à jour du login' });
          }
        }

      } catch (error: any) {
        console.error('Erreur lors de la mise à jour du login:', error);
        res.status(500).send({ error: 'Erreur lors de la mise à jour du login' });
      }
    });
  });