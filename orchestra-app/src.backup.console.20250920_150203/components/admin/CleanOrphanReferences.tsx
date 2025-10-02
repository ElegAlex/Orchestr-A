import React, { useState } from 'react';
import {
  Button,
  Alert,
  Box,
  Typography,
  Paper,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';

const CleanOrphanReferences: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const cleanOrphanReferences = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Récupérer tous les utilisateurs existants
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const existingUserIds = new Set(usersSnapshot.docs.map(doc => doc.id));

      // Récupérer tous les projets
      const projectsSnapshot = await getDocs(collection(db, 'projects'));

      const orphanReferences: any[] = [];
      const projectsToUpdate: any[] = [];

      // Vérifier chaque projet
      for (const projectDoc of projectsSnapshot.docs) {
        const projectData = projectDoc.data();
        const projectId = projectDoc.id;

        if (projectData.teamMembers && Array.isArray(projectData.teamMembers)) {
          const validMembers: any[] = [];
          const orphanMembers: any[] = [];

          // Vérifier chaque membre de l'équipe
          for (const member of projectData.teamMembers) {
            if (existingUserIds.has(member.userId)) {
              validMembers.push(member);
            } else {
              orphanMembers.push(member);
              orphanReferences.push({
                projectId,
                projectName: projectData.name || 'Projet sans nom',
                userId: member.userId,
                role: member.role || 'Non défini'
              });
            }
          }

          // Si des orphelins détectés, préparer la mise à jour
          if (orphanMembers.length > 0) {
            projectsToUpdate.push({
              id: projectId,
              name: projectData.name || 'Projet sans nom',
              orphanCount: orphanMembers.length,
              newTeamMembers: validMembers
            });
          }
        }
      }
      // Nettoyer les références orphelines
      if (projectsToUpdate.length > 0) {
        const batch = writeBatch(db);

        for (const project of projectsToUpdate) {
          const projectRef = doc(db, 'projects', project.id);
          batch.update(projectRef, {
            teamMembers: project.newTeamMembers,
            updatedAt: new Date()
          });
        }

        await batch.commit();
      }

      setResult({
        totalProjects: projectsSnapshot.size,
        totalUsers: existingUserIds.size,
        orphanReferences: orphanReferences.length,
        projectsUpdated: projectsToUpdate.length,
        details: {
          orphanRefs: orphanReferences,
          updatedProjects: projectsToUpdate
        }
      });

    } catch (err) {
      
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CleaningServicesIcon color="info" />
        Nettoyage des références orphelines
      </Typography>

      <Typography variant="body2" color="text.secondary" paragraph>
        Cet outil supprime les références aux utilisateurs supprimés dans les équipes de projets.
      </Typography>

      {!result && (
        <Button
          variant="contained"
          color="info"
          onClick={cleanOrphanReferences}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <CleaningServicesIcon />}
        >
          {loading ? 'Nettoyage en cours...' : 'Lancer le nettoyage'}
        </Button>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Box sx={{ mt: 2 }}>
          <Alert
            severity={result.orphanReferences > 0 ? "success" : "info"}
            sx={{ mb: 2 }}
          >
            {result.orphanReferences > 0
              ? `✅ ${result.orphanReferences} références orphelines nettoyées dans ${result.projectsUpdated} projets !`
              : '✅ Aucune référence orpheline trouvée !'
            }
          </Alert>

          <Typography variant="h6" gutterBottom>
            Statistiques :
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText
                primary="Projets analysés"
                secondary={result.totalProjects}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Utilisateurs existants"
                secondary={result.totalUsers}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Références orphelines supprimées"
                secondary={result.orphanReferences}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Projets mis à jour"
                secondary={result.projectsUpdated}
              />
            </ListItem>
          </List>

          {result.details.orphanRefs.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Références orphelines supprimées :
              </Typography>
              <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                {result.details.orphanRefs.map((ref: any, index: number) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemText
                        primary={`${ref.projectName}`}
                        secondary={`Utilisateur: ${ref.userId} | Rôle: ${ref.role}`}
                      />
                    </ListItem>
                    {index < result.details.orphanRefs.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          )}

          <Button
            variant="outlined"
            onClick={() => {
              setResult(null);
              window.location.reload();
            }}
            sx={{ mt: 2 }}
          >
            Rafraîchir la page
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default CleanOrphanReferences;