import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  IconButton,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Menu,
  MenuItem,
  Grid,
  Tooltip,
  Avatar,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon,
  MoreVert as MoreVertIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  Archive as ArchiveIcon,
  Code as CodeIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TaskAttachment } from '../../types';
import { attachmentService, UploadProgress, UploadResult } from '../../services/attachment.service';

interface TaskAttachmentsProps {
  taskId: string;
  currentUserId: string;
  readOnly?: boolean;
}

interface UploadingFile {
  file: File;
  progress: UploadProgress;
  result?: UploadResult;
  error?: string;
}

const FILE_TAGS = [
  'Spécification',
  'Design',
  'Code',
  'Documentation',
  'Test',
  'Screenshot',
  'Logo',
  'Mockup',
  'Rapport',
  'Présentation',
];

export const TaskAttachments: React.FC<TaskAttachmentsProps> = ({
  taskId,
  currentUserId,
  readOnly = false,
}) => {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<TaskAttachment | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAttachments();
    
    // S'abonner aux pièces jointes en temps réel
    const unsubscribe = attachmentService.subscribeToTaskAttachments(taskId, (newAttachments) => {
      setAttachments(newAttachments);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [taskId]);

  const loadAttachments = async () => {
    try {
      const taskAttachments = await attachmentService.getTaskAttachments(taskId);
      setAttachments(taskAttachments);
    } catch (error) {
      console.error('Erreur lors du chargement des pièces jointes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      uploadFiles(files);
    }
    // Reset input
    event.target.value = '';
  };

  const uploadFiles = async (files: File[]) => {
    const initialUploading = files.map(file => ({
      file,
      progress: { loaded: 0, total: file.size, percentage: 0 },
    }));
    
    setUploadingFiles(initialUploading);

    const results = await attachmentService.uploadMultipleFiles(
      files,
      taskId,
      currentUserId,
      (fileIndex, progress) => {
        setUploadingFiles(prev => 
          prev.map((item, index) => 
            index === fileIndex ? { ...item, progress } : item
          )
        );
      },
      (fileIndex, result) => {
        setUploadingFiles(prev => 
          prev.map((item, index) => 
            index === fileIndex ? { ...item, result } : item
          )
        );
      }
    );

    // Nettoyer les uploads terminés après un délai
    setTimeout(() => {
      setUploadingFiles([]);
    }, 3000);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      uploadFiles(files);
    }
  };

  const handleEditAttachment = (attachment: TaskAttachment) => {
    setEditingAttachment(attachment);
    setEditDescription(attachment.description || '');
    setEditTags(attachment.tags || []);
    setEditIsPublic(attachment.isPublic);
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleSaveEdit = async () => {
    if (!editingAttachment) return;

    try {
      await attachmentService.updateAttachment(editingAttachment.id, {
        description: editDescription,
        tags: editTags,
        isPublic: editIsPublic,
      });
      
      setEditDialogOpen(false);
      setEditingAttachment(null);
      loadAttachments();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette pièce jointe ?')) {
      try {
        await attachmentService.deleteAttachment(attachmentId);
        loadAttachments();
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
    handleMenuClose();
  };

  const handleDownload = (attachment: TaskAttachment) => {
    const link = document.createElement('a');
    link.href = attachment.downloadUrl;
    link.download = attachment.originalName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = (attachment: TaskAttachment) => {
    setPreviewAttachment(attachment);
    setPreviewDialogOpen(true);
    handleMenuClose();
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, attachmentId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedAttachmentId(attachmentId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAttachmentId(null);
  };

  const formatFileTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: fr });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon />;
    if (mimeType.includes('pdf')) return <PdfIcon />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <DocIcon />;
    if (mimeType.includes('zip') || mimeType.includes('rar')) return <ArchiveIcon />;
    if (mimeType.includes('javascript') || mimeType.includes('json')) return <CodeIcon />;
    if (mimeType.startsWith('audio/')) return <AudioIcon />;
    if (mimeType.startsWith('video/')) return <VideoIcon />;
    return <AttachFileIcon />;
  };

  const canPreview = (mimeType: string) => {
    return mimeType.startsWith('image/') || mimeType.includes('pdf') || mimeType.startsWith('text/');
  };

  const renderPreview = (attachment: TaskAttachment) => {
    if (attachment.mimeType.startsWith('image/')) {
      return (
        <Box sx={{ textAlign: 'center' }}>
          <img
            src={attachment.downloadUrl}
            alt={attachment.originalName}
            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        </Box>
      );
    }

    if (attachment.mimeType.includes('pdf')) {
      return (
        <Box sx={{ height: '70vh' }}>
          <embed
            src={attachment.downloadUrl}
            type="application/pdf"
            width="100%"
            height="100%"
          />
        </Box>
      );
    }

    return (
      <Alert severity="info">
        Aperçu non disponible pour ce type de fichier.
        <Button onClick={() => handleDownload(attachment)} sx={{ ml: 1 }}>
          Télécharger
        </Button>
      </Alert>
    );
  };

  const totalSize = attachments.reduce((sum, att) => sum + att.fileSize, 0);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Chargement des pièces jointes...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          📎 Pièces jointes ({attachments.length})
          {totalSize > 0 && (
            <Chip
              label={attachmentService.formatFileSize(totalSize)}
              size="small"
              variant="outlined"
            />
          )}
        </Typography>
        
        {!readOnly && (
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            Ajouter des fichiers
          </Button>
        )}
      </Box>

      {/* Zone de drag & drop */}
      {!readOnly && (
        <Paper
          ref={dragRef}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sx={{
            p: 3,
            mb: 2,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
            cursor: 'pointer',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h6" gutterBottom>
            Glissez-déposez vos fichiers ici
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ou cliquez pour parcourir (max 50MB par fichier)
          </Typography>
        </Paper>
      )}

      {/* Input file caché */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Fichiers en cours d'upload */}
      {uploadingFiles.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Upload en cours...
          </Typography>
          {uploadingFiles.map((uploading, index) => (
            <Card key={index} sx={{ mb: 1 }}>
              <CardContent sx={{ py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AttachFileIcon />
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {uploading.file.name}
                  </Typography>
                  <Typography variant="caption">
                    {uploading.progress.percentage.toFixed(0)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={uploading.progress.percentage}
                  sx={{ mt: 1 }}
                />
                {uploading.result && (
                  <Typography variant="caption" color={uploading.result.success ? 'success.main' : 'error.main'}>
                    {uploading.result.success ? '✅ Uploadé' : `❌ ${uploading.result.error}`}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Liste des pièces jointes */}
      {attachments.length === 0 ? (
        <Alert severity="info">
          Aucune pièce jointe pour cette tâche.
          {!readOnly && ' Ajoutez vos premiers fichiers ci-dessus !'}
        </Alert>
      ) : (
        <List>
          {attachments.map((attachment) => (
            <Card key={attachment.id} sx={{ mb: 1 }}>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.light' }}>
                    {getFileIcon(attachment.mimeType)}
                  </Avatar>
                </ListItemAvatar>
                
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {attachment.originalName}
                      </Typography>
                      {attachment.isPublic && (
                        <Chip label="Public" size="small" color="success" />
                      )}
                      {attachment.tags && attachment.tags.length > 0 && (
                        <>
                          {attachment.tags.map((tag, index) => (
                            <Chip key={index} label={tag} size="small" variant="outlined" />
                          ))}
                        </>
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        {attachmentService.formatFileSize(attachment.fileSize)} • 
                        Ajouté par {attachment.uploadedBy} • 
                        {formatFileTime(attachment.uploadedAt)}
                      </Typography>
                      {attachment.description && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {attachment.description}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                
                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Télécharger">
                      <IconButton size="small" onClick={() => handleDownload(attachment)}>
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                    
                    {canPreview(attachment.mimeType) && (
                      <Tooltip title="Aperçu">
                        <IconButton size="small" onClick={() => handlePreview(attachment)}>
                          <PreviewIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuClick(e, attachment.id)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            </Card>
          ))}
        </List>
      )}

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          const attachment = attachments.find(a => a.id === selectedAttachmentId);
          if (attachment) handleEditAttachment(attachment);
        }}>
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Modifier
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedAttachmentId) handleDeleteAttachment(selectedAttachmentId);
        }}>
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Supprimer
        </MenuItem>
      </Menu>

      {/* Dialog d'édition */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier la pièce jointe</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            multiline
            rows={3}
            margin="normal"
          />
          
          <Autocomplete
            multiple
            freeSolo
            options={FILE_TAGS}
            value={editTags}
            onChange={(_, newTags) => setEditTags(newTags)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip variant="outlined" label={option} {...getTagProps({ index })} />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Tags"
                placeholder="Ajoutez des tags..."
                margin="normal"
              />
            )}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={editIsPublic}
                onChange={(e) => setEditIsPublic(e.target.checked)}
              />
            }
            label="Fichier public (visible par tous)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleSaveEdit}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de prévisualisation */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {previewAttachment?.originalName}
          <Typography variant="caption" display="block" color="text.secondary">
            {previewAttachment && attachmentService.formatFileSize(previewAttachment.fileSize)}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {previewAttachment && renderPreview(previewAttachment)}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialogOpen(false)}>
            Fermer
          </Button>
          {previewAttachment && (
            <Button variant="contained" onClick={() => handleDownload(previewAttachment)}>
              Télécharger
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};