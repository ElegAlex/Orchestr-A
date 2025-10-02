import { configureStore } from '@reduxjs/toolkit';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AppState {
  auth: AuthState;
}

const initialState: AppState = {
  auth: {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  },
};

const mockReducer = (state = initialState, action: any) => {
  return state;
};

export const store = configureStore({
  reducer: {
    auth: mockReducer,
  },
});

export type RootState = AppState;
export type AppDispatch = typeof store.dispatch;