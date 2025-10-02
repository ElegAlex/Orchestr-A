import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Collapse
} from '@mui/material';
import {
  Upload,
  Download,
  Error,
  CheckCircle,
  Warning,
  Task as TaskIcon,
  Flag,
  Close,
  Info,
  ExpandMore,
  ExpandLess,
  ContentPaste,
  Description
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { importService, ImportRow, ImportResult, ImportPreview } from '../../services/import.service';

interface ProjectImportDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onImportSuccess: (result: ImportResult) => void;
}

const ProjectImportDialog: React.FC<ProjectImportDialogProps> = ({
  open,
  onClose,
  projectId,
  projectName,
  onImportSuccess
}) => {
  const [importText, setImportText] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [importMethod, setImportMethod] = useState<'file' | 'paste' | null>(null);

  // Gestion du drag & drop pour les fichiers CSV
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setImportText(text);
        setImportMethod('file');
        handlePreview(text, 'csv');
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls', '.xlsx']
    },
    multiple: false
  });

  const handlePreview = async (text: string, source: 'csv' | 'clipboard') => {
    if (!text.trim()) return;

    setIsLoading(true);
    try {
      let data: ImportRow[];
      
      if (source === 'csv') {
        data = await importService.parseCSV(text);
      } else {
        data = await importService.parseClipboard(text);
      }

      const previewResult = await importService.validateImportData(data);
      setPreview(previewResult);
    } catch (error) {
      console.error('Erreur lors de la prévisualisation:', error);
      setPreview({
        isValid: false,
        totalRows: 0,
        taskCount: 0,
        milestoneCount: 0,
        errors: [{
          row: 0,
          message: `Erreur de parsing: ${error}`,
          data: {} as ImportRow
        }],
        data: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview || !preview.isValid) return;

    setIsLoading(true);
    try {
      const result = await importService.importToProject(projectId, preview.data);
      setImportResult(result);
      
      if (result.success) {
        setTimeout(() => {
          onImportSuccess(result);
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      setImportResult({
        success: false,
        totalRows: preview.data.length,
        successCount: 0,
        errorCount: 1,
        errors: [{
          row: 0,
          message: `Erreur d'import: ${error}`,
          data: {} as ImportRow
        }],
        createdTasks: [],
        createdMilestones: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteText = () => {
    if (importText.trim()) {
      setImportMethod('paste');
      handlePreview(importText, 'clipboard');
    }
  };

  const handleDownloadTemplate = () => {
    const template = importService.generateTemplateCSV();
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-import-${projectName.toLowerCase().replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setImportText('');
    setPreview(null);
    setImportResult(null);
    setImportMethod(null);
    setShowHelp(false);
    onClose();
  };

  const resetImport = () => {
    setImportText('');
    setPreview(null);
    setImportResult(null);
    setImportMethod(null);
  };

  const getStatusColor = (type: string) => {
    return type === 'TASK' || type === 'TACHE' || type === 'TÂCHE' ? 'primary' : 'secondary';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'P0':
      case 'CRITIQUE': return 'error';
      case 'P1':
      case 'HAUTE': return 'warning';
      case 'P2':
      case 'NORMALE': return 'info';
      case 'P3':
      case 'BASSE': return 'success';
      default: return 'default';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{ sx: { height: '90vh' } }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            Import de tâches et jalons - {projectName}
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              size="small"
              startIcon={<Download />}
              onClick={handleDownloadTemplate}
              variant="outlined"
            >
              Template CSV
            </Button>
            <IconButton onClick={handleClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {isLoading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Si résultat d'import, afficher uniquement le résultat */}
        {importResult ? (
          <Box>
            <Alert 
              severity={importResult.success ? "success" : "error"} 
              sx={{ mb: 3 }}
            >
              {importResult.success ? (
                <Box>
                  <Typography variant="h6">Import réussi!</Typography>
                  <Typography>
                    {importResult.successCount} éléments importés : 
                    {importResult.createdTasks.length} tâches et {importResult.createdMilestones.length} jalons
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Typography variant="h6">Erreurs lors de l'import</Typography>
                  <Typography>
                    {importResult.successCount} réussites, {importResult.errorCount} erreurs
                  </Typography>
                </Box>
              )}
            </Alert>

            {importResult.errors.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>Détail des erreurs:</Typography>
                <List>
                  {importResult.errors.map((error, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Error color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Ligne ${error.row}${error.field ? ` - ${error.field}` : ''}`}
                        secondary={error.message}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {/* Colonne gauche - Import */}
            <Box>
              {/* Guide rapide collapsible */}
              <Box mb={2}>
                <Button
                  onClick={() => setShowHelp(!showHelp)}
                  endIcon={showHelp ? <ExpandLess /> : <ExpandMore />}
                  startIcon={<Info />}
                  size="small"
                  variant="text"
                >
                  Format attendu
                </Button>
                <Collapse in={showHelp}>
                  <Paper sx={{ p: 2, mt: 1, bgcolor: 'grey.50' }}>
                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          Champs obligatoires
                        </Typography>
                        <List dense>
                          <ListItem>
                            <ListItemText 
                              primary={<Typography variant="body2"><strong>Type</strong></Typography>}
                              secondary="TACHE ou JALON"
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText 
                              primary={<Typography variant="body2"><strong>Nom</strong></Typography>}
                              secondary="Titre de la tâche/jalon"
                            />
                          </ListItem>
                        </List>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                          Champs facultatifs
                        </Typography>
                        <List dense>
                          <ListItem>
                            <ListItemText 
                              primary="Description"
                              secondary={<Typography variant="caption">Texte libre</Typography>}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText 
                              primary="Date_début, Date_fin"
                              secondary={<Typography variant="caption">Format: YYYY-MM-DD</Typography>}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText 
                              primary="Priorité"
                              secondary={<Typography variant="caption">P0, P1, P2, P3</Typography>}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText 
                              primary="Assigné"
                              secondary={<Typography variant="caption">Email valide</Typography>}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemText 
                              primary="Status"
                              secondary={<Typography variant="caption">TODO, IN_PROGRESS, DONE</Typography>}
                            />
                          </ListItem>
                        </List>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      <strong>Exemple complet:</strong>{'\n'}
                      Type,Nom,Description,Date_début,Date_fin,Priorité,Assigné,Status,Parent{'\n'}
                      JALON,Livraison V1.0,Version finale du système,2025-01-15,2025-01-15,P0,,upcoming,{'\n'}
                      TACHE,Développer interface,Écrans de connexion,2025-01-10,2025-01-14,P1,dev@email.com,TODO,Livraison V1.0
                    </Typography>
                  </Paper>
                </Collapse>
              </Box>

              {/* Zone d'import */}
              {!preview && (
                <>
                  {/* Drag & Drop */}
                  <Box
                    {...getRootProps()}
                    sx={{
                      border: '2px dashed',
                      borderColor: isDragActive ? 'primary.main' : 'grey.300',
                      borderRadius: 2,
                      p: 3,
                      textAlign: 'center',
                      cursor: 'pointer',
                      bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                      transition: 'all 0.2s ease-in-out',
                      mb: 2
                    }}
                  >
                    <input {...getInputProps()} />
                    <Upload sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                    <Typography variant="h6" gutterBottom>
                      Glissez votre fichier CSV ici
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ou cliquez pour sélectionner
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 2 }}>OU</Divider>

                  {/* Copier-coller */}
                  <TextField
                    label="Collez vos données ici (depuis Excel, Notion, etc.)"
                    multiline
                    rows={8}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    fullWidth
                    variant="outlined"
                    placeholder="Type	Nom	Description
JALON	Livraison V1	Version finale
TACHE	Développer login	Interface auth"
                    sx={{ 
                      fontFamily: 'monospace',
                      '& .MuiInputBase-input': { fontSize: '0.85rem' }
                    }}
                  />

                  {importText && (
                    <Box mt={2} display="flex" gap={2}>
                      <Button
                        variant="contained"
                        onClick={handlePasteText}
                        startIcon={<ContentPaste />}
                      >
                        Analyser les données
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={resetImport}
                      >
                        Effacer
                      </Button>
                    </Box>
                  )}
                </>
              )}

              {/* Si preview existe mais pas de méthode, on est en train d'analyser */}
              {preview && !importMethod && (
                <Alert severity="info">
                  Analyse des données en cours...
                </Alert>
              )}
            </Box>

            {/* Colonne droite - Prévisualisation */}
            {preview && (
              <Box>
                <Box>
                  {/* Résumé */}
                  <Box display="flex" alignItems="center" mb={2}>
                    <Box display="flex" alignItems="center" mr={3}>
                      {preview.isValid ? (
                        <CheckCircle color="success" sx={{ mr: 1 }} />
                      ) : (
                        <Warning color="warning" sx={{ mr: 1 }} />
                      )}
                      <Typography variant="h6">
                        {preview.isValid ? 'Prêt à importer' : `${preview.errors.length} erreur(s)`}
                      </Typography>
                    </Box>
                    <Box display="flex" gap={1}>
                      <Chip 
                        icon={<TaskIcon />} 
                        label={`${preview.taskCount} tâches`} 
                        color="primary" 
                        size="small"
                      />
                      <Chip 
                        icon={<Flag />} 
                        label={`${preview.milestoneCount} jalons`} 
                        color="secondary" 
                        size="small"
                      />
                    </Box>
                  </Box>

                  {/* Erreurs */}
                  {!preview.isValid && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Corrigez ces erreurs avant l'import:
                      </Typography>
                      <List dense>
                        {preview.errors.slice(0, 3).map((error, index) => (
                          <ListItem key={index}>
                            <ListItemText
                              primary={`Ligne ${error.row}${error.field ? ` - ${error.field}` : ''}`}
                              secondary={error.message}
                            />
                          </ListItem>
                        ))}
                        {preview.errors.length > 3 && (
                          <ListItem>
                            <ListItemText
                              secondary={`... et ${preview.errors.length - 3} autres erreurs`}
                            />
                          </ListItem>
                        )}
                      </List>
                    </Alert>
                  )}

                  {/* Tableau de prévisualisation */}
                  <Typography variant="subtitle2" gutterBottom>
                    Aperçu des données
                  </Typography>
                  <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Nom</TableCell>
                          <TableCell>Priorité</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {preview.data.slice(0, 10).map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Chip 
                                label={row.Type} 
                                size="small"
                                color={getStatusColor(row.Type)}
                              />
                            </TableCell>
                            <TableCell>
                              <Tooltip title={row.Description || ''}>
                                <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                                  {row.Nom}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              {row.Priorité && (
                                <Chip 
                                  label={row.Priorité} 
                                  size="small"
                                  color={getPriorityColor(row.Priorité)}
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption">
                                {row.Status || 'TODO'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {preview.data.length > 10 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      ... et {preview.data.length - 10} autres lignes
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {preview && !importResult && (
          <Button onClick={resetImport} sx={{ mr: 'auto' }}>
            Recommencer
          </Button>
        )}
        
        <Button onClick={handleClose}>
          {importResult?.success ? 'Fermer' : 'Annuler'}
        </Button>
        
        {preview && preview.isValid && !importResult && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={isLoading}
            startIcon={<Upload />}
          >
            {isLoading ? 'Import en cours...' : `Importer ${preview.totalRows} lignes`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ProjectImportDialog;