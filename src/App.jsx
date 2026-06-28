import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useApp } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { preloadSounds } from './services/sounds';
import { AuthScreen } from './components/screens/AuthScreen';
import { HomeScreen } from './components/screens/HomeScreen';
import { FlightModeScreen } from './components/screens/FlightModeScreen';
import { CityModeScreen } from './components/screens/CityModeScreen';
import { WorkScreen } from './components/screens/WorkScreen';
import { BreakScreen } from './components/screens/BreakScreen';
import { StatsScreen } from './components/screens/StatsScreen';
import { FlightPlanScreen } from './components/screens/FlightPlanScreen';
import { HangarScreen } from './components/screens/HangarScreen';
import { LiveSessionsScreen } from './components/screens/LiveSessionsScreen';
import { LiveRoomScreen } from './components/screens/LiveRoomScreen';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.18 } },
};

function Screen() {
  const { state } = useApp();
  const { screen } = state;

  const screens = {
    home:          <HomeScreen />,
    hangar:        <HangarScreen />,
    'live-sessions': <LiveSessionsScreen />,
    'live-room':   <LiveRoomScreen />,
    'live-select': <FlightModeScreen />,
    'city-select': <CityModeScreen />,
    work:          <WorkScreen />,
    break:         <BreakScreen />,
    stats:         <StatsScreen />,
    'flight-plan': <FlightPlanScreen />,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screen}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ width: '100%', minHeight: screen === 'work' ? '100vh' : undefined }}
      >
        {screens[screen] || <HomeScreen />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const { state } = useApp();
  const { loading, isAuthenticated, isGuest } = useAuth();
  const isDark = state.theme === 'dark';

  useEffect(() => {
    if (isAuthenticated || isGuest) preloadSounds();
  }, [isAuthenticated, isGuest]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#08101E' }}>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ color: '#00b4d8', fontSize: 28 }}
        >
          ✈
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated && !isGuest) {
    return (
      <div className="relative min-h-screen" style={{ background: '#08101E' }}>
        <div className="stars-bg" />
        <AuthScreen />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen" data-theme={state.theme}>
      {isDark ? <div className="stars-bg" /> : <div className="sky-bg" />}
      <Screen />
    </div>
  );
}
