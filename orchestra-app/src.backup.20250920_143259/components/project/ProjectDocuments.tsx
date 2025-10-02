import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  Grid,
  Stack,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  TableChart as ExcelIcon,
  Code as CodeIcon,
  Folder as FolderIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  MoreVert as MoreVertIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { TaskAttachment } from '../../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { documentService, Document as DocumentType } from '../../services/document.service';

interface ProjectDocumentsProps {
  projectId: string;
}

interface Document extends DocumentType {
  category?: 'requirement' | 'design' | 'technical' | 'test' | 'other';
  mimeType: string;
  fileSize?: number;
  fileName?: string;
  fileUrl?: string;
}

const ProjectDocuments: React.FC<ProjectDocumentsProps> = ({ projectId }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState<Document['category']>('other');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const projectDocuments = await documentService.getProjectDocuments(projectId);

      // Adapter le format pour inclure mimeType et category
      const adaptedDocuments = projectDocuments.map(doc => ({
        ...doc,
        mimeType: doc.type,
        category: 'other' as const,
        fileName: doc.originalName,
        fileUrl: doc.url,
        fileSize: doc.size
      }));

      setDocuments(adaptedDocuments);
    } catch (error) {
      console.error('Erreur lors du chargement des documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon />;
    if (mimeType === 'application/pdf') return <PdfIcon />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <DocIcon />;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <ExcelIcon />;
    if (mimeType.includes('text') || mimeType.includes('code')) return <CodeIcon />;
    return <FileIcon />;
  };

  const getCategoryLabel = (category?: Document['category']) => {
    switch (category) {
      case 'requirement': return 'Exigences';
      case 'design': return 'Design';
      case 'technical': return 'Technique';
      case 'test': return 'Tests';
      default: return 'Autre';
    }
  };

  const getCategoryColor = (category?: Document['category']) => {
    switch (category) {
      case 'requirement': return 'primary';
      case 'design': return 'secondary';
      case 'technical': return 'info';
      case 'test': return 'warning';
      default: return 'default';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadDialogOpen(true);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);

      const uploadedDocument = await documentService.uploadDocument(selectedFile, {
        projectId,
        description: uploadDescription,
        tags: uploadCategory ? [uploadCategory] : [],
        isPublic: true
      });

      // Adapter le format et ajouter à la liste
      const adaptedDocument = {
        ...uploadedDocument,
        mimeType: uploadedDocument.type,
        category: uploadCategory,
        fileName: uploadedDocument.originalName,
        fileUrl: uploadedDocument.url,
        fileSize: uploadedDocument.size
      };

      setDocuments(prev => [adaptedDocument, ...prev]);

      setUploadDialogOpen(false);
      setSelectedFile(null);
      setUploadDescription('');
      setUploadCategory('other');
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      console.error('Détails de l\'erreur:', {
        message: error instanceof Error ? error.message : 'Message inconnu',
        type: typeof error,
        fileName: selectedFile?.name,
        fileSize: selectedFile?.size,
        fileType: selectedFile?.type
      });

      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue lors de l\'upload';
      alert(`Erreur lors de l'upload du document: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, document: Document) => {
    setAnchorEl(event.currentTarget);
    setSelectedDocument(document);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDocument(null);
  };

  const handleDownload = async () => {
    if (selectedDocument) {
      try {
        await documentService.downloadDocument(selectedDocument.id);
      } catch (error) {
        console.error('Erreur lors du téléchargement:', error);
        alert('Erreur lors du téléchargement du document.');
      }
    }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (selectedDocument && window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      try {
        setLoading(true);
        await documentService.deleteDocument(selectedDocument.id);
        setDocuments(docs => docs.filter(doc => doc.id !== selectedDocument.id));
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression du document.');
      } finally {
        setLoading(false);
      }
    }
    handleMenuClose();
  };

  const groupedDocuments = documents.reduce((acc, doc) => {
    const category = doc.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Documents du projet ({documents.length})
        </Typography>
        <input
          type="file"
          id="file-upload"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <label htmlFor="file-upload">
          <Button
            variant="contained"
            component="span"
            startIcon={<CloudUploadIcon />}
          >
            Ajouter un document
          </Button>
        </label>
      </Box>

      {/* Statistiques */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {documents.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Documents
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="secondary">
                {documents.reduce((acc, doc) => acc + doc.size, 0) > 0 ?
                  formatFileSize(documents.reduce((acc, doc) => acc + doc.size, 0)) : '0 MB'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Taille totale
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {Object.keys(groupedDocuments).length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Catégories
              </Typography>
            </CardContent>
          </Card>
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {documents.filter(d => d.isPublic !== false).length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Publics
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : documents.length === 0 ? (
        <Alert severity="info">
          Aucun document dans ce projet. Commencez par ajouter des documents !
        </Alert>
      ) : (
        <Stack spacing={3}>
          {Object.entries(groupedDocuments).map(([category, categoryDocs]) => (
            <Card key={category}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <FolderIcon color="action" />
                  <Typography variant="h6">
                    {getCategoryLabel(category as Document['category'])}
                  </Typography>
                  <Chip
                    label={categoryDocs.length}
                    size="small"
                    color={getCategoryColor(category as Document['category'])}
                  />
                </Box>

                <List>
                  {categoryDocs.map((document) => (
                    <ListItem key={document.id} divider>
                      <ListItemIcon>
                        {getFileIcon(document.mimeType)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle2">
                              {document.fileName || document.originalName}
                            </Typography>
                            {document.version > 1 && (
                              <Chip label={`v${document.version}`} size="small" />
                            )}
                            {!document.isPublic && (
                              <Chip label="Privé" size="small" color="warning" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {document.description}
                            </Typography>
                            <br />
                            <Typography variant="caption" color="text.secondary">
                              {formatFileSize(document.size)} •
                              Ajouté le {format(new Date(document.uploadedAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={(e) => handleMenuClick(e, document)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Dialog d'upload */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter un document</DialogTitle>
        <DialogContent>
          {selectedFile && (
            <Box mb={2} p={2} bgcolor="grey.100" borderRadius={1}>
              <Typography variant="subtitle2">
                Fichier sélectionné: {selectedFile.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Taille: {formatFileSize(selectedFile.size)}
              </Typography>
            </Box>
          )}

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Description"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              multiline
              rows={3}
              placeholder="Décrivez brièvement ce document..."
            />

            <TextField
              fullWidth
              select
              label="Catégorie"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as Document['category'])}
            >
              <MenuItem value="requirement">Exigences</MenuItem>
              <MenuItem value="design">Design</MenuItem>
              <MenuItem value="technical">Technique</MenuItem>
              <MenuItem value="test">Tests</MenuItem>
              <MenuItem value="other">Autre</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleUploadSubmit} 
            variant="contained"
            disabled={!selectedFile}
          >
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { /* TODO: Ouvrir */ handleMenuClose(); }}>
          <ViewIcon sx={{ mr: 1 }} />
          Ouvrir
        </MenuItem>
        <MenuItem onClick={handleDownload}>
          <DownloadIcon sx={{ mr: 1 }} />
          Télécharger
        </MenuItem>
        <MenuItem onClick={() => { /* TODO: Partager */ handleMenuClose(); }}>
          <ShareIcon sx={{ mr: 1 }} />
          Partager
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Supprimer
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ProjectDocuments;