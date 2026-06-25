import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from './context/AppContext';
import { HomeScreen } from './components/screens/HomeScreen';
import { FlightModeScreen } from './components/screens/FlightModeScreen';
import { CityModeScreen } from './components/screens/CityModeScreen';
import { WorkScreen } from './components/screens/WorkScreen';
import { BreakScreen } from './components/screens/BreakScreen';
import { StatsScreen } from './components/screens/StatsScreen';
import { FlightPlanScreen } from './components/screens/FlightPlanScreen';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.18 } },
};

function Screen() {
  const { state } = useApp();
  const { screen } = state;

  const screens = {
    home: <HomeScreen />,
    'live-select': <FlightModeScreen />,
    'city-select': <CityModeScreen />,
    work: <WorkScreen />,
    break: <BreakScreen />,
    stats: <StatsScreen />,
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
  const isDark = state.theme === 'dark';

  return (
    <div className="relative min-h-screen" data-theme={state.theme}>
      {isDark ? (
        <div className="stars-bg" />
      ) : (
        <div className="sky-bg" />
      )}
      <Screen />
    </div>
  );
}
