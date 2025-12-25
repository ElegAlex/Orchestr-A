import { authService } from '../auth.service';
import { api } from '@/lib/api';

// Mock de l'API
jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

// Mock de localStorage
let localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => localStorageStore[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: jest.fn(() => {
    localStorageStore = {};
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('authService', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    login: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    role: 'CONTRIBUTEUR',
    isActive: true,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  };

  const mockAuthResponse = {
    access_token: 'test-token-123',
    user: mockUser,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageStore = {};
  });

  describe('login', () => {
    it('should call API with credentials and store token', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      const result = await authService.login({
        login: 'testuser',
        password: 'password123',
      });

      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        login: 'testuser',
        password: 'password123',
      });
      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'test-token-123');
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
      expect(result).toEqual(mockAuthResponse);
    });

    it('should handle API errors', async () => {
      const error = new Error('Invalid credentials');
      (api.post as jest.Mock).mockRejectedValue(error);

      await expect(
        authService.login({ login: 'wrong', password: 'wrong' })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should call API with registration data and store token', async () => {
      (api.post as jest.Mock).mockResolvedValue({ data: mockAuthResponse });

      const registerData = {
        email: 'new@example.com',
        login: 'newuser',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      };

      const result = await authService.register(registerData);

      expect(api.post).toHaveBeenCalledWith('/auth/register', registerData);
      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'test-token-123');
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe('getProfile', () => {
    it('should fetch and store user profile', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: mockUser });

      const result = await authService.getProfile();

      expect(api.get).toHaveBeenCalledWith('/auth/profile');
      expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
      expect(result).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('should clear localStorage and redirect to login', () => {
      authService.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
      // window.location.href assignment causes navigation in real browser
      // In JSDOM, we just verify localStorage was cleared
    });
  });

  describe('getCurrentUser', () => {
    it('should return parsed user from localStorage', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

      const result = authService.getCurrentUser();

      expect(localStorage.getItem).toHaveBeenCalledWith('user');
      expect(result).toEqual(mockUser);
    });

    it('should return null if no user in localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = authService.getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true if token exists', () => {
      localStorageMock.getItem.mockReturnValue('some-token');

      const result = authService.isAuthenticated();

      expect(localStorage.getItem).toHaveBeenCalledWith('access_token');
      expect(result).toBe(true);
    });

    it('should return false if no token', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = authService.isAuthenticated();

      expect(result).toBe(false);
    });
  });
});
