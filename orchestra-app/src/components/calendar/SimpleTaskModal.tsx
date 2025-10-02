import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Box,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { CreateSimpleTaskInput } from '../../types/simpleTask';
import { User } from '../../types';
import { userService } from '../../services/user.service';

interface SimpleTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (task: CreateSimpleTaskInput, userIds: string[]) => Promise<void>;
  currentUserId: string;
}

export const SimpleTaskModal: React.FC<SimpleTaskModalProps> = ({
  open,
  onClose,
  onCreate,
  currentUserId,
}) => {
  // Form data
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [priority, setPriority] = useState<'P0' | 'P1' | 'P2' | 'P3'>('P2');

  // Duplication
  const [enableDuplication, setEnableDuplication] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set([currentUserId]));

  const [loading, setLoading] = useState(false);

  // Load users
  useEffect(() => {
    if (open && enableDuplication) {
      userService.getAllUsers().then(setUsers);
    }
  }, [open, enableDuplication]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setDate(new Date());
      setStartTime('09:00');
      setEndTime('17:00');
      setPriority('P2');
      setEnableDuplication(false);
      setSelectedUserIds(new Set([currentUserId]));
    }
  }, [open, currentUserId]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('Le titre est requis');
      return;
    }

    setLoading(true);
    try {
      const taskInput: CreateSimpleTaskInput = {
        title: title.trim(),
        description: description.trim(),
        date,
        timeSlot: {
          start: startTime,
          end: endTime,
        },
        priority,
      };

      const userIds = Array.from(selectedUserIds);
      await onCreate(taskInput, userIds);
      onClose();
    } catch (error) {
      console.error('Erreur création tâche simple:', error);
      alert('Erreur lors de la création de la tâche');
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      if (newSet.size > 1) newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const selectAll = () => {
    setSelectedUserIds(new Set(users.map(u => u.id)));
  };

  const deselectAll = () => {
    setSelectedUserIds(new Set([currentUserId]));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Nouvelle tâche simple</DialogTitle>

        <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Titre */}
          <TextField
            label="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
          />

          {/* Description */}
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />

          {/* Date */}
          <DateTimePicker
            label="Date et heure"
            value={date}
            onChange={(newValue) => newValue && setDate(newValue)}
          />

          {/* Horaires */}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Début"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Fin"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          {/* Priorité */}
          <FormControl fullWidth>
            <InputLabel>Priorité</InputLabel>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              label="Priorité"
            >
              <MenuItem value="P0">🔴 P0 - Critique</MenuItem>
              <MenuItem value="P1">🟠 P1 - Haute</MenuItem>
              <MenuItem value="P2">🔵 P2 - Normale</MenuItem>
              <MenuItem value="P3">⚪ P3 - Basse</MenuItem>
            </Select>
          </FormControl>

          {/* Duplication */}
          <FormControlLabel
            control={
              <Checkbox
                checked={enableDuplication}
                onChange={(e) => setEnableDuplication(e.target.checked)}
              />
            }
            label="Dupliquer pour plusieurs utilisateurs"
          />

          {enableDuplication && (
            <Box>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Button size="small" onClick={selectAll}>
                  Tout sélectionner
                </Button>
                <Button size="small" onClick={deselectAll}>
                  Désélectionner tout
                </Button>
              </Stack>

              <Typography variant="caption" color="text.secondary">
                {selectedUserIds.size} utilisateur(s) sélectionné(s)
              </Typography>

              <List dense sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ddd', borderRadius: 1 }}>
                {users.map((user) => (
                  <ListItem key={user.id} disablePadding>
                    <ListItemButton onClick={() => toggleUser(user.id)}>
                      <ListItemIcon>
                        <Checkbox
                          checked={selectedUserIds.has(user.id)}
                          edge="start"
                          tabIndex={-1}
                          disableRipple
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${user.firstName} ${user.lastName}`}
                        secondary={user.email}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Stack>
      </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {loading ? 'Création...' : `Créer ${selectedUserIds.size} tâche(s)`}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};
