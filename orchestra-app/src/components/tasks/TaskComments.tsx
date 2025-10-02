import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Divider,
  Tooltip,
  Alert,
  CircularProgress,
  Paper,
  Autocomplete,
  Popper,
} from '@mui/material';
import {
  Send as SendIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Reply as ReplyIcon,
  ThumbUp as ThumbUpIcon,
  Favorite as HeartIcon,
  EmojiEmotions as EmojiIcon,
  AlternateEmail as MentionIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TaskComment, User } from '../../types';
import { commentService } from '../../services/comment.service';

interface TaskCommentsProps {
  taskId: string;
  currentUserId: string;
}

interface MentionSuggestion {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

const EMOJI_REACTIONS = ['👍', '❤️', '😄', '🎉', '👏', '🤔'];

export const TaskComments: React.FC<TaskCommentsProps> = ({ taskId, currentUserId }) => {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const textFieldRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadComments();
    
    // S'abonner aux commentaires en temps réel
    const unsubscribe = commentService.subscribeToTaskComments(taskId, (newComments) => {
      setComments(newComments);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [taskId]);

  useEffect(() => {
    // Scroll vers le bas quand de nouveaux commentaires arrivent
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const loadComments = async () => {
    try {
      const taskComments = await commentService.getTaskComments(taskId);
      setComments(taskComments);
    } catch (error) {
      console.error('Erreur lors du chargement des commentaires:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const mentions = commentService.extractMentions(newComment);
      
      const comment = await commentService.addComment({
        taskId,
        authorId: currentUserId,
        content: newComment,
        mentions,
        parentId: replyingTo || undefined,
        type: 'comment',
      });

      // Notifier les utilisateurs mentionnés
      if (mentions.length > 0) {
        await commentService.notifyMentionedUsers(mentions, comment.id, taskId);
      }

      setNewComment('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Erreur lors de l\'ajout du commentaire:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingText.trim()) return;

    try {
      const mentions = commentService.extractMentions(editingText);
      await commentService.updateComment(commentId, {
        content: editingText,
        mentions,
      });
      
      setEditingCommentId(null);
      setEditingText('');
      loadComments();
    } catch (error) {
      console.error('Erreur lors de la modification du commentaire:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await commentService.deleteComment(commentId);
      setAnchorEl(null);
      loadComments();
    } catch (error) {
      console.error('Erreur lors de la suppression du commentaire:', error);
    }
  };

  const handleReaction = async (commentId: string, emoji: string) => {
    try {
      await commentService.addReaction(commentId, currentUserId, emoji);
      loadComments();
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la réaction:', error);
    }
  };

  const handleTextChange = (value: string) => {
    setNewComment(value);
    
    // Détecter les mentions (@username)
    const cursorPos = textFieldRef.current?.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setCursorPosition(cursorPos);
      setShowMentions(true);
      searchUsers(query);
    } else {
      setShowMentions(false);
      setMentionSuggestions([]);
    }
  };

  const searchUsers = async (query: string) => {
    try {
      const users = await commentService.searchUsers(query);
      setMentionSuggestions(users.map(user => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
      })));
    } catch (error) {
      console.error('Erreur lors de la recherche d\'utilisateurs:', error);
    }
  };

  const handleMentionSelect = (user: MentionSuggestion) => {
    const textBeforeMention = newComment.substring(0, cursorPosition - mentionQuery.length - 1);
    const textAfterMention = newComment.substring(cursorPosition);
    const newText = `${textBeforeMention}@${user.displayName} ${textAfterMention}`;
    
    setNewComment(newText);
    setShowMentions(false);
    setMentionSuggestions([]);
    
    // Focus back on the text field
    setTimeout(() => {
      textFieldRef.current?.focus();
    }, 0);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, commentId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedCommentId(commentId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCommentId(null);
  };

  const formatCommentTime = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true, locale: fr });
  };

  const getCommentTypeIcon = (type: TaskComment['type']) => {
    switch (type) {
      case 'status_change':
        return '🔄';
      case 'assignment_change':
        return '👤';
      case 'due_date_change':
        return '📅';
      default:
        return '💬';
    }
  };

  const renderMentions = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is a mention
        return (
          <Chip
            key={index}
            label={`@${part}`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ mx: 0.5, fontSize: '0.75rem' }}
          />
        );
      }
      return part;
    });
  };

  const renderComment = (comment: TaskComment, isReply = false) => {
    const isEditing = editingCommentId === comment.id;
    const isAuthor = comment.authorId === currentUserId;
    const replies = comments.filter(c => c.parentId === comment.id);

    return (
      <Box key={comment.id} sx={{ mb: 2 }}>
        <Card 
          variant={isReply ? "outlined" : "elevation"} 
          elevation={isReply ? 0 : 1}
          sx={{ 
            ml: isReply ? 4 : 0,
            bgcolor: isReply ? 'action.hover' : 'background.paper'
          }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Avatar
                sx={{ width: 32, height: 32 }}
                src={`https://avatar.vercel.sh/${comment.authorId}`}
              >
                {comment.authorId.substring(0, 1).toUpperCase()}
              </Avatar>
              
              <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {comment.authorId}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {getCommentTypeIcon(comment.type)} {formatCommentTime(comment.createdAt)}
                  </Typography>
                  {comment.updatedAt && comment.updatedAt > comment.createdAt && (
                    <Typography variant="caption" color="text.secondary">
                      (modifié)
                    </Typography>
                  )}
                </Box>
                
                {isEditing ? (
                  <Box>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      variant="outlined"
                      size="small"
                    />
                    <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleEditComment(comment.id)}
                      >
                        Sauvegarder
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setEditingCommentId(null)}
                      >
                        Annuler
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                      {renderMentions(comment.content)}
                    </Typography>
                    
                    {/* Réactions */}
                    {comment.reactions && comment.reactions.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                        {Object.entries(
                          comment.reactions.reduce((acc: Record<string, number>, reaction) => {
                            acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([emoji, count]) => (
                          <Chip
                            key={emoji}
                            label={`${emoji} ${count}`}
                            size="small"
                            variant="outlined"
                            clickable
                            onClick={() => handleReaction(comment.id, emoji)}
                            sx={{ fontSize: '0.7rem', height: 24 }}
                          />
                        ))}
                      </Box>
                    )}
                  </>
                )}
              </Box>
              
              <Box>
                <IconButton
                  size="small"
                  onClick={(e) => handleMenuClick(e, comment.id)}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
            
            {!isEditing && (
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                {EMOJI_REACTIONS.map((emoji) => (
                  <Tooltip key={emoji} title={`Réagir avec ${emoji}`}>
                    <Button
                      size="small"
                      onClick={() => handleReaction(comment.id, emoji)}
                      sx={{ minWidth: 'auto', p: 0.5, fontSize: '0.8rem' }}
                    >
                      {emoji}
                    </Button>
                  </Tooltip>
                ))}
                
                <Button
                  size="small"
                  startIcon={<ReplyIcon />}
                  onClick={() => setReplyingTo(comment.id)}
                  sx={{ ml: 1 }}
                >
                  Répondre
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
        
        {/* Réponses */}
        {replies.map(reply => renderComment(reply, true))}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Commentaires de niveau racine (pas de parentId)
  const rootComments = comments.filter(c => !c.parentId);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        💬 Commentaires ({comments.length})
      </Typography>

      {/* Liste des commentaires */}
      <Box sx={{ maxHeight: '60vh', overflowY: 'auto', mb: 2 }}>
        {rootComments.length === 0 ? (
          <Alert severity="info">
            Aucun commentaire pour l'instant. Soyez le premier à commenter !
          </Alert>
        ) : (
          rootComments.map(comment => renderComment(comment))
        )}
        <div ref={commentsEndRef} />
      </Box>

      {/* Zone de réponse */}
      {replyingTo && (
        <Alert 
          severity="info" 
          sx={{ mb: 2 }}
          action={
            <Button onClick={() => setReplyingTo(null)}>
              Annuler
            </Button>
          }
        >
          Réponse à un commentaire...
        </Alert>
      )}

      {/* Nouveau commentaire */}
      <Paper sx={{ p: 2, position: 'relative' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Avatar
            sx={{ width: 32, height: 32 }}
            src={`https://avatar.vercel.sh/${currentUserId}`}
          >
            {currentUserId.substring(0, 1).toUpperCase()}
          </Avatar>
          
          <Box sx={{ flexGrow: 1 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Écrivez un commentaire... (utilisez @ pour mentionner quelqu'un)"
              value={newComment}
              onChange={(e) => handleTextChange(e.target.value)}
              variant="outlined"
              inputRef={textFieldRef}
              InputProps={{
                endAdornment: (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Tooltip title="Mentionner quelqu'un">
                      <IconButton size="small">
                        <MentionIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )
              }}
            />
            
            {/* Suggestions de mentions */}
            {showMentions && mentionSuggestions.length > 0 && (
              <Paper
                elevation={3}
                sx={{
                  position: 'absolute',
                  zIndex: 1000,
                  maxHeight: 200,
                  overflowY: 'auto',
                  mt: 1,
                  width: '80%',
                }}
              >
                {mentionSuggestions.map((user) => (
                  <MenuItem
                    key={user.id}
                    onClick={() => handleMentionSelect(user)}
                    sx={{ py: 1 }}
                  >
                    <Avatar
                      sx={{ width: 24, height: 24, mr: 1 }}
                      src={user.avatarUrl}
                    >
                      {user.displayName.substring(0, 1).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{user.displayName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Paper>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? <CircularProgress size={20} /> : 'Commenter'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            const comment = comments.find(c => c.id === selectedCommentId);
            if (comment) {
              setEditingCommentId(comment.id);
              setEditingText(comment.content);
            }
            handleMenuClose();
          }}
        >
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Modifier
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedCommentId) {
              handleDeleteComment(selectedCommentId);
            }
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Supprimer
        </MenuItem>
      </Menu>
    </Box>
  );
};