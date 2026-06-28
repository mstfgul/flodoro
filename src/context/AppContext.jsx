import { createContext, useContext, useReducer, useEffect } from 'react';

const DEFAULT_SETTINGS = {
  breakDuration: 5,
  mapView: 'animated',
  autoStartBreak: true,
  soundEnabled: true,
  notifEnabled: false,
};

const initialState = {
  screen: 'home',
  mode: null,
  subMode: null,
  session: null,
  selectedFlight: null,
  settings: DEFAULT_SETTINGS,
  theme: 'dark',
  flightPlan: { legs: [], date: null },
  liveCode: null, // join code of the current live session room
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, screen: action.payload };
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_SUBMODE':
      return { ...state, subMode: action.payload };
    case 'START_SESSION':
      return {
        ...state,
        screen: 'work',
        selectedFlight: null, // don't leak live selection into new session
        session: { ...action.payload, status: 'running', elapsed: 0, backendId: null },
      };
    case 'SET_SESSION_STATUS':
      return { ...state, session: { ...state.session, status: action.payload } };
    case 'TICK':
      return { ...state, session: { ...state.session, elapsed: state.session.elapsed + 1 } };
    case 'SELECT_FLIGHT':
      return { ...state, selectedFlight: action.payload };
    case 'UPDATE_FLIGHT_POS':
      return { ...state, selectedFlight: { ...state.selectedFlight, ...action.payload } };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_BACKEND_ID':
      return { ...state, session: { ...state.session, backendId: action.payload } };
    case 'GO_BREAK':
      return { ...state, screen: 'break', session: { ...state.session, status: 'break' } };
    case 'FLIGHT_PLAN_ADD_LEG': {
      const today = new Date().toISOString().slice(0, 10);
      const legs = (state.flightPlan?.date === today ? state.flightPlan.legs : []);
      return { ...state, flightPlan: { date: today, legs: [...legs, action.payload] } };
    }
    case 'FLIGHT_PLAN_REMOVE_LEG': {
      const legs = (state.flightPlan?.legs ?? []).filter(l => l.id !== action.payload);
      return { ...state, flightPlan: { ...state.flightPlan, legs } };
    }
    case 'FLIGHT_PLAN_SET_ACTIVE': {
      const legs = (state.flightPlan?.legs ?? []).map(l =>
        l.id === action.payload ? { ...l, status: 'active' } : l
      );
      return { ...state, flightPlan: { ...state.flightPlan, legs } };
    }
    case 'FLIGHT_PLAN_COMPLETE_LEG': {
      const legs = (state.flightPlan?.legs ?? []).map(l =>
        l.id === action.payload ? { ...l, status: 'completed' } : l
      );
      return { ...state, flightPlan: { ...state.flightPlan, legs } };
    }
    case 'SET_LIVE_CODE':
      return { ...state, liveCode: action.payload };
    case 'RESET':
      return { ...initialState, settings: state.settings, theme: state.theme, flightPlan: state.flightPlan };
    default:
      return state;
  }
}

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const s = localStorage.getItem('flodoro_settings');
      const t = localStorage.getItem('flodoro_theme') || 'dark';
      if (s) return { ...init, settings: { ...init.settings, ...JSON.parse(s) }, theme: t };
      return { ...init, theme: t };
    } catch {
      return init;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('flodoro_settings', JSON.stringify(state.settings));
      localStorage.setItem('flodoro_theme', state.theme);
    } catch {}
  }, [state.settings, state.theme]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
