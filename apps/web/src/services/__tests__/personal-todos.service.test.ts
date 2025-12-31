import { personalTodosService } from "../personal-todos.service";
import api from "@/lib/api";

jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe("personalTodosService", () => {
  const mockTodo = {
    id: "todo-1",
    userId: "user-1",
    text: "Complete task",
    completed: false,
    createdAt: "2025-01-01T10:00:00Z",
    completedAt: null,
    updatedAt: "2025-01-01T10:00:00Z",
  };

  const mockTodos = [
    mockTodo,
    { ...mockTodo, id: "todo-2", text: "Another task" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAll", () => {
    it("should fetch all personal todos", async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockTodos });

      const result = await personalTodosService.getAll();

      expect(api.get).toHaveBeenCalledWith("/personal-todos");
      expect(result).toEqual(mockTodos);
    });
  });

  describe("create", () => {
    it("should create a new personal todo", async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockTodo });

      const result = await personalTodosService.create({
        text: "Complete task",
      });

      expect(api.post).toHaveBeenCalledWith("/personal-todos", {
        text: "Complete task",
      });
      expect(result).toEqual(mockTodo);
    });
  });

  describe("update", () => {
    it("should update a personal todo text", async () => {
      const updatedTodo = { ...mockTodo, text: "Updated task" };
      (api.patch as jest.Mock).mockResolvedValue({ data: updatedTodo });

      const result = await personalTodosService.update("todo-1", {
        text: "Updated task",
      });

      expect(api.patch).toHaveBeenCalledWith("/personal-todos/todo-1", {
        text: "Updated task",
      });
      expect(result).toEqual(updatedTodo);
    });

    it("should mark a personal todo as completed", async () => {
      const completedTodo = {
        ...mockTodo,
        completed: true,
        completedAt: "2025-01-02T15:00:00Z",
      };
      (api.patch as jest.Mock).mockResolvedValue({ data: completedTodo });

      const result = await personalTodosService.update("todo-1", {
        completed: true,
      });

      expect(api.patch).toHaveBeenCalledWith("/personal-todos/todo-1", {
        completed: true,
      });
      expect(result).toEqual(completedTodo);
    });
  });

  describe("delete", () => {
    it("should delete a personal todo", async () => {
      (api.delete as jest.Mock).mockResolvedValue({});

      await personalTodosService.delete("todo-1");

      expect(api.delete).toHaveBeenCalledWith("/personal-todos/todo-1");
    });
  });
});
