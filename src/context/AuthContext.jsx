import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  token: localStorage.getItem('flodoro_token') || null,
  isGuest: localStorage.getItem('flodoro_guest') === 'true',
  loading: true,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false, isGuest: false };
    case 'SET_GUEST':
      return { ...state, user: null, token: null, isGuest: true, loading: false };
    case 'SET_TOKEN':
      return { ...state, token: action.payload };
    case 'LOGOUT':
      return { ...initialState, token: null, isGuest: false, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem('flodoro_token');
    const guest = localStorage.getItem('flodoro_guest') === 'true';
    if (token) {
      api.me()
        .then((user) => dispatch({ type: 'SET_USER', payload: user }))
        .catch(() => {
          localStorage.removeItem('flodoro_token');
          dispatch({ type: 'LOGOUT' });
        });
    } else if (guest) {
      dispatch({ type: 'SET_GUEST' });
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await api.login(email, password);
    localStorage.setItem('flodoro_token', token);
    localStorage.removeItem('flodoro_guest');
    dispatch({ type: 'SET_TOKEN', payload: token });
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const register = useCallback(async (email, password, name) => {
    const { token, user } = await api.register(email, password, name);
    localStorage.setItem('flodoro_token', token);
    localStorage.removeItem('flodoro_guest');
    dispatch({ type: 'SET_TOKEN', payload: token });
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const continueAsGuest = useCallback(() => {
    localStorage.setItem('flodoro_guest', 'true');
    localStorage.removeItem('flodoro_token');
    dispatch({ type: 'SET_GUEST' });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('flodoro_token');
    localStorage.removeItem('flodoro_guest');
    dispatch({ type: 'LOGOUT' });
  }, []);

  const isAuthenticated = !!state.user;

  return (
    <AuthContext.Provider value={{ ...state, isAuthenticated, login, register, continueAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
