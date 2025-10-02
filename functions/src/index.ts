import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { cors } from './middleware/cors';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// Email configuration
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().email?.user || process.env.EMAIL_USER,
    pass: functions.config().email?.pass || process.env.EMAIL_PASS,
  },
});


// ============= TRIGGERS =============

// Nouveau projet créé - Notifications
export const onProjectCreated = functions.firestore
  .document('projects/{projectId}')
  .onCreate(async (snap, context) => {
    const project = snap.data();
    const projectId = context.params.projectId;

    try {
      // Créer une activité
      await db.collection('activities').add({
        type: 'project_created',
        projectId,
        projectName: project.name,
        userId: project.createdBy,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        description: `Nouveau projet créé: ${project.name}`,
      });

      // Notifier tous les membres de l'équipe
      if (project.teamMembers && project.teamMembers.length > 0) {
        const notifications = project.teamMembers.map((memberId: string) => ({
          userId: memberId,
          type: 'project_assigned',
          title: 'Nouveau projet',
          message: `Vous avez été assigné au projet ${project.name}`,
          projectId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }));

        const batch = db.batch();
        notifications.forEach((notif: any) => {
          const ref = db.collection('notifications').doc();
          batch.set(ref, notif);
        });
        await batch.commit();
      }

      console.log(`Project ${projectId} created successfully`);
    } catch (error) {
      console.error('Error in onProjectCreated:', error);
    }
  });

// Tâche assignée - Notification
export const onTaskAssigned = functions.firestore
  .document('tasks/{taskId}')
  .onWrite(async (change, context) => {
    const taskId = context.params.taskId;
    const before = change.before.data();
    const after = change.after.data();

    if (!after) return; // Document supprimé

    // Vérifier si l'assignation a changé
    if (before?.assigneeId !== after.assigneeId && after.assigneeId) {
      try {
        // Créer notification
        await db.collection('notifications').add({
          userId: after.assigneeId,
          type: 'task_assigned',
          title: 'Nouvelle tâche assignée',
          message: `La tâche "${after.title}" vous a été assignée`,
          taskId,
          projectId: after.projectId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Créer activité
        await db.collection('activities').add({
          type: 'task_assigned',
          taskId,
          taskTitle: after.title,
          projectId: after.projectId,
          userId: after.assigneeId,
          assignedBy: after.lastModifiedBy,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Envoyer email si configuré
        const user = await auth.getUser(after.assigneeId);
        if (user.email) {
          await sendTaskAssignmentEmail(user.email, after.title, after.description);
        }
      } catch (error) {
        console.error('Error in onTaskAssigned:', error);
      }
    }

    // Vérifier si le statut a changé
    if (before?.status !== after.status) {
      await db.collection('activities').add({
        type: 'task_status_changed',
        taskId,
        taskTitle: after.title,
        projectId: after.projectId,
        userId: after.lastModifiedBy,
        fromStatus: before?.status,
        toStatus: after.status,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

// Date limite approchante - Rappels automatiques
export const checkDeadlines = functions.pubsub
  .schedule('every day 09:00')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const threeDaysFromNow = new admin.firestore.Timestamp(
      now.seconds + 3 * 24 * 60 * 60,
      now.nanoseconds
    );

    try {
      // Chercher les tâches dues dans les 3 prochains jours
      const tasksSnapshot = await db
        .collection('tasks')
        .where('status', 'in', ['todo', 'in_progress'])
        .where('dueDate', '>=', now)
        .where('dueDate', '<=', threeDaysFromNow)
        .get();

      const notifications: any[] = [];
      const emails: any[] = [];

      for (const doc of tasksSnapshot.docs) {
        const task = doc.data();
        if (task.assigneeId) {
          // Créer notification
          notifications.push({
            userId: task.assigneeId,
            type: 'deadline_reminder',
            title: 'Date limite approchante',
            message: `La tâche "${task.title}" est due le ${task.dueDate.toDate().toLocaleDateString('fr-FR')}`,
            taskId: doc.id,
            projectId: task.projectId,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Préparer email
          const user = await auth.getUser(task.assigneeId);
          if (user.email) {
            emails.push({
              to: user.email,
              subject: `Rappel: ${task.title}`,
              text: `La tâche "${task.title}" doit être complétée avant le ${task.dueDate.toDate().toLocaleDateString('fr-FR')}`,
            });
          }
        }
      }

      // Envoyer toutes les notifications
      if (notifications.length > 0) {
        const batch = db.batch();
        notifications.forEach((notif: any) => {
          const ref = db.collection('notifications').doc();
          batch.set(ref, notif);
        });
        await batch.commit();
      }

      // Envoyer tous les emails
      for (const email of emails) {
        await sendEmail(email.to, email.subject, email.text);
      }

      console.log(`Sent ${notifications.length} deadline reminders`);
    } catch (error) {
      console.error('Error in checkDeadlines:', error);
    }
  });

// ============= HTTP FUNCTIONS =============

// Webhook pour intégrations externes
export const webhook = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { type, data, secret } = req.body;

    // Vérifier le secret
    if (secret !== functions.config().webhook?.secret) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      switch (type) {
        case 'create_task':
          const task = await db.collection('tasks').add({
            ...data,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'todo',
          });
          res.json({ success: true, taskId: task.id });
          break;

        case 'update_project':
          await db.collection('projects').doc(data.projectId).update(data.updates);
          res.json({ success: true });
          break;

        case 'sync_users':
          // Synchronisation avec système externe (LDAP, etc.)
          const users = data.users;
          for (const user of users) {
            try {
              await auth.createUser({
                email: user.email,
                displayName: user.name,
                password: user.password || generatePassword(),
              });
            } catch (e) {
              console.log(`User ${user.email} might already exist`);
            }
          }
          res.json({ success: true, count: users.length });
          break;

        default:
          res.status(400).send('Unknown webhook type');
      }
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).send('Internal Server Error');
    }
  });
});

// Création d'utilisateur avec login/password (Admin et Responsable uniquement)
export const createUserWithLogin = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    // Vérifier la méthode HTTP
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    try {
      // Vérifier l'authentification via le token
      const authorization = req.headers.authorization;
      if (!authorization || !authorization.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
      }

      const idToken = authorization.split('Bearer ')[1];
      const decodedToken = await auth.verifyIdToken(idToken);
      const callerUid = decodedToken.uid;

      // Récupérer les données de l'utilisateur appelant
      const callerDoc = await db.collection('users').doc(callerUid).get();
      if (!callerDoc.exists) {
        res.status(403).json({ error: 'Caller user not found' });
        return;
      }

      const callerData = callerDoc.data();
      
      // Vérifier que l'appelant est admin ou responsable
      if (callerData?.role !== 'admin' && callerData?.role !== 'responsable') {
        res.status(403).json({ error: 'Forbidden: Only admin or responsable can create users' });
        return;
      }

      // Récupérer les données du nouvel utilisateur
      const { login, password, firstName, lastName, role, department, displayName } = req.body;

      // Validation des données
      if (!login || !password || !firstName || !lastName || !role) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Générer un email interne pour Firebase Auth
      const internalEmail = `${login}@orchestr-a.internal`;

      // Créer l'utilisateur dans Firebase Auth
      const userRecord = await auth.createUser({
        email: internalEmail,
        password: password,
        displayName: displayName || `${firstName} ${lastName}`,
      });

      // Définir les custom claims (rôle)
      await auth.setCustomUserClaims(userRecord.uid, {
        role: role,
      });

      // Créer le profil utilisateur dans Firestore
      const userData = {
        email: internalEmail,
        login: login,
        loginType: 'internal',
        firstName: firstName,
        lastName: lastName,
        displayName: displayName || `${firstName} ${lastName}`,
        role: role,
        department: department || '',
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: callerUid,
        lastLoginAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        permissions: [], // Les permissions sont gérées par le rôle
      };

      await db.collection('users').doc(userRecord.uid).set(userData);

      // Retourner le succès
      res.status(200).json({
        success: true,
        uid: userRecord.uid,
        message: `Utilisateur ${login} créé avec succès`,
      });

    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Gestion des erreurs spécifiques
      if (error.code === 'auth/email-already-exists') {
        res.status(400).json({ error: 'Ce login est déjà utilisé' });
      } else if (error.code === 'auth/weak-password') {
        res.status(400).json({ error: 'Le mot de passe est trop faible' });
      } else if (error.code === 'auth/invalid-email') {
        res.status(400).json({ error: 'Format de login invalide' });
      } else {
        res.status(500).json({ error: error.message || 'Internal Server Error' });
      }
    }
  });
});

// Génération de rapports
export const generateReport = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { projectId, startDate, endDate, type } = data;

  try {
    let report: any = {
      generatedAt: new Date().toISOString(),
      generatedBy: context.auth.uid,
      type,
    };

    switch (type) {
      case 'project_summary':
        const project = await db.collection('projects').doc(projectId).get();
        const tasks = await db.collection('tasks')
          .where('projectId', '==', projectId)
          .get();
        
        const tasksByStatus = tasks.docs.reduce((acc, doc) => {
          const status = doc.data().status;
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as any);

        report.data = {
          project: project.data(),
          totalTasks: tasks.size,
          tasksByStatus,
          completionRate: (tasksByStatus.done || 0) / tasks.size * 100,
        };
        break;

      case 'team_performance':
        const activities = await db.collection('activities')
          .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(new Date(startDate)))
          .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(new Date(endDate)))
          .get();

        const performanceByUser: any = {};
        activities.docs.forEach(doc => {
          const activity = doc.data();
          if (!performanceByUser[activity.userId]) {
            performanceByUser[activity.userId] = {
              tasksCompleted: 0,
              tasksCreated: 0,
              activities: 0,
            };
          }
          performanceByUser[activity.userId].activities++;
          if (activity.type === 'task_completed') {
            performanceByUser[activity.userId].tasksCompleted++;
          }
          if (activity.type === 'task_created') {
            performanceByUser[activity.userId].tasksCreated++;
          }
        });

        report.data = { performanceByUser };
        break;

      case 'time_tracking':
        const timeEntries = await db.collection('timeEntries')
          .where('date', '>=', startDate)
          .where('date', '<=', endDate)
          .get();

        let totalHours = 0;
        const hoursByProject: any = {};
        const hoursByUser: any = {};

        timeEntries.docs.forEach(doc => {
          const entry = doc.data();
          totalHours += entry.hours;
          
          hoursByProject[entry.projectId] = (hoursByProject[entry.projectId] || 0) + entry.hours;
          hoursByUser[entry.userId] = (hoursByUser[entry.userId] || 0) + entry.hours;
        });

        report.data = {
          totalHours,
          hoursByProject,
          hoursByUser,
          averageHoursPerDay: totalHours / ((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)),
        };
        break;

      default:
        throw new Error('Unknown report type');
    }

    // Sauvegarder le rapport
    const reportDoc = await db.collection('reports').add(report);
    
    return { success: true, reportId: reportDoc.id, report };
  } catch (error) {
    console.error('Error generating report:', error);
    throw new functions.https.HttpsError('internal', 'Error generating report');
  }
});

// Nettoyage des données obsolètes
export const cleanupOldData = functions.pubsub
  .schedule('every sunday 02:00')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const sixMonthsAgo = new admin.firestore.Timestamp(
      admin.firestore.Timestamp.now().seconds - 180 * 24 * 60 * 60,
      0
    );

    try {
      // Supprimer les notifications lues de plus de 6 mois
      const oldNotifications = await db
        .collection('notifications')
        .where('read', '==', true)
        .where('createdAt', '<', sixMonthsAgo)
        .get();

      const batch = db.batch();
      oldNotifications.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Supprimer les activités de plus de 6 mois
      const oldActivities = await db
        .collection('activities')
        .where('timestamp', '<', sixMonthsAgo)
        .get();

      oldActivities.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.log(`Cleaned up ${oldNotifications.size} notifications and ${oldActivities.size} activities`);
    } catch (error) {
      console.error('Error in cleanupOldData:', error);
    }
  });

// Export de données pour backup
export const exportData = functions.https.onCall(async (data, context) => {
  // Vérifier que l'utilisateur est admin
  if (!context.auth || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can export data');
  }

  try {
    const collections = ['projects', 'tasks', 'users', 'teams', 'documents'];
    const exportData: any = {};

    for (const collection of collections) {
      const snapshot = await db.collection(collection).get();
      exportData[collection] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    }

    // Sauvegarder dans Storage
    const bucket = admin.storage().bucket();
    const fileName = `exports/backup-${Date.now()}.json`;
    const file = bucket.file(fileName);
    
    await file.save(JSON.stringify(exportData, null, 2), {
      metadata: {
        contentType: 'application/json',
      },
    });

    // Obtenir l'URL de téléchargement
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 heures
    });

    return { success: true, downloadUrl: url, fileName };
  } catch (error) {
    console.error('Error exporting data:', error);
    throw new functions.https.HttpsError('internal', 'Error exporting data');
  }
});

// ============= HELPER FUNCTIONS =============

function generatePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  try {
    await mailTransporter.sendMail({
      from: functions.config().email?.from || 'noreply@orchestr-a.fr',
      to,
      subject,
      text,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #1976d2;">Orchestr'A</h2>
          <p>${text.replace(/\n/g, '<br>')}</p>
          <hr style="border: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">
            Cet email a été envoyé automatiquement. Ne pas répondre.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

async function sendTaskAssignmentEmail(to: string, taskTitle: string, taskDescription: string): Promise<void> {
  const subject = `Nouvelle tâche assignée: ${taskTitle}`;
  const text = `Une nouvelle tâche vous a été assignée:\n\nTitre: ${taskTitle}\nDescription: ${taskDescription}\n\nConnectez-vous à Orchestr'A pour plus de détails.`;
  await sendEmail(to, subject, text);
}