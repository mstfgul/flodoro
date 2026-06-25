import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function ThemeToggle() {
  const { state, dispatch } = useApp();
  const isDark = state.theme === 'dark';

  const toggle = () =>
    dispatch({ type: 'SET_THEME', payload: isDark ? 'light' : 'dark' });

  return (
    <motion.button
      onClick={toggle}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
        isDark
          ? 'glass border-white/10 text-[#94a3b8] hover:text-white'
          : 'bg-amber-100 border-amber-200 text-amber-700 hover:bg-amber-200'
      }`}
    >
      <motion.span
        initial={false}
        animate={{ rotate: isDark ? 0 : 180 }}
        transition={{ duration: 0.3 }}
      >
        {isDark ? <Moon size={13} /> : <Sun size={13} />}
      </motion.span>
      {isDark ? 'Dark' : 'Light'}
    </motion.button>
  );
}
