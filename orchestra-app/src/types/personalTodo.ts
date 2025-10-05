export type PersonalTodoPriority = 'low' | 'medium' | 'high';

export interface PersonalTodo {
  id: string;
  userId: string;
  text: string;
  completed: boolean;
  priority?: PersonalTodoPriority;
  createdAt: Date;
  completedAt?: Date;
}

export interface CreatePersonalTodoInput {
  text: string;
  priority?: PersonalTodoPriority;
}
