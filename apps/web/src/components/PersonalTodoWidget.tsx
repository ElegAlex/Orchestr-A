'use client';

import React, { useState, useEffect } from 'react';
import { personalTodosService, PersonalTodo } from '@/services/personal-todos.service';
import toast from 'react-hot-toast';

const MAX_TODOS = 20;

export const PersonalTodoWidget = () => {
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTodoText, setNewTodoText] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const activeTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const data = await personalTodosService.getAll();
      setTodos(data);
    } catch (error: any) {
      toast.error('Erreur lors du chargement des to-dos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTodo = async () => {
    if (!newTodoText.trim()) return;
    if (todos.length >= MAX_TODOS) {
      toast.error(`Limite de ${MAX_TODOS} to-dos atteinte`);
      return;
    }

    try {
      setAdding(true);
      const newTodo = await personalTodosService.create({ text: newTodoText.trim() });
      setTodos([newTodo, ...todos]);
      setNewTodoText('');
      toast.success('To-do ajoutée');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'ajout');
      console.error(error);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleCompleted = async (todo: PersonalTodo) => {
    try {
      const updated = await personalTodosService.update(todo.id, {
        completed: !todo.completed,
      });
      setTodos(todos.map(t => (t.id === todo.id ? updated : t)));
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await personalTodosService.delete(id);
      setTodos(todos.filter(t => t.id !== id));
      toast.success('To-do supprimée');
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    }
  };

  const handleStartEdit = (todo: PersonalTodo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) {
      setEditingId(null);
      return;
    }

    try {
      const updated = await personalTodosService.update(id, { text: editText.trim() });
      setTodos(todos.map(t => (t.id === id ? updated : t)));
      setEditingId(null);
      toast.success('To-do modifiée');
    } catch (error: any) {
      toast.error('Erreur lors de la modification');
      console.error(error);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">📝 Ma To-Do</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header - même style que "Mes tâches à venir" */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">📝 Ma To-Do</h2>
        <span className="text-sm text-gray-500">
          {activeTodos.length}/{todos.length}
        </span>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Input Add */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
            placeholder="Ajouter une to-do..."
            disabled={adding || todos.length >= MAX_TODOS}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
          />
          <button
            onClick={handleAddTodo}
            disabled={adding || !newTodoText.trim() || todos.length >= MAX_TODOS}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition text-sm font-medium"
          >
            {adding ? '...' : '+ Ajouter'}
          </button>
        </div>

        {/* Warning limite */}
        {todos.length >= MAX_TODOS && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            ⚠️ Limite de {MAX_TODOS} to-dos atteinte
          </div>
        )}

        {/* Liste To-dos */}
        {todos.length === 0 ? (
          <p className="text-gray-500 text-center py-8 text-sm">
            Aucune to-do pour le moment
          </p>
        ) : (
          <div className="space-y-2">
            {/* Actives */}
            {activeTodos.map(todo => (
              <div
                key={todo.id}
                className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition group flex items-center gap-3"
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => handleToggleCompleted(todo)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer flex-shrink-0"
                />
                {editingId === todo.id ? (
                  <>
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(todo.id);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="flex-1 px-2 py-1 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(todo.id)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex-shrink-0"
                    >
                      ✓
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 flex-shrink-0"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="flex-1 text-sm text-gray-900 cursor-pointer"
                      onDoubleClick={() => handleStartEdit(todo)}
                      title="Double-cliquer pour éditer"
                    >
                      {todo.text}
                    </span>
                    <button
                      onClick={() => handleDelete(todo.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 transition flex-shrink-0 text-sm"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            ))}

            {/* Complétées */}
            {completedTodos.length > 0 && (
              <>
                {activeTodos.length > 0 && (
                  <div className="pt-2 pb-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase">
                      Complétées ({completedTodos.length})
                    </div>
                  </div>
                )}
                {completedTodos.map(todo => (
                  <div
                    key={todo.id}
                    className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition group flex items-center gap-3 opacity-60"
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => handleToggleCompleted(todo)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer flex-shrink-0"
                    />
                    <span className="flex-1 text-sm text-gray-600 line-through">
                      {todo.text}
                    </span>
                    <button
                      onClick={() => handleDelete(todo.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800 transition flex-shrink-0 text-sm"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
