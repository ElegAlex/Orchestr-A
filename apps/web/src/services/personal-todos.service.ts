import api from "@/lib/api";

export interface PersonalTodo {
  id: string;
  userId: string;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
}

export interface CreatePersonalTodoDto {
  text: string;
}

export interface UpdatePersonalTodoDto {
  text?: string;
  completed?: boolean;
}

class PersonalTodosService {
  private baseUrl = "/personal-todos";

  async getAll(): Promise<PersonalTodo[]> {
    const { data } = await api.get<PersonalTodo[]>(this.baseUrl);
    return data;
  }

  async create(dto: CreatePersonalTodoDto): Promise<PersonalTodo> {
    const { data } = await api.post<PersonalTodo>(this.baseUrl, dto);
    return data;
  }

  async update(id: string, dto: UpdatePersonalTodoDto): Promise<PersonalTodo> {
    const { data } = await api.patch<PersonalTodo>(
      `${this.baseUrl}/${id}`,
      dto,
    );
    return data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }
}

export const personalTodosService = new PersonalTodosService();
