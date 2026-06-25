import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Navigation, Plane, BarChart2, Zap, CalendarDays, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import { startAirportAmbience, stopAirportAmbience } from '../../services/sounds';

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function HomeScreen() {
  const { dispatch, state } = useApp();
  const soundEnabled = state.settings?.soundEnabled !== false;

  useEffect(() => {
    if (!soundEnabled) return;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      startAirportAmbience(0.18).catch(() => {});
      document.removeEventListener('pointerdown', start);
    };
    const t = setTimeout(() => {
      startAirportAmbience(0.18).catch(() => {
        if (!started) document.addEventListener('pointerdown', start, { once: true });
      });
    }, 600);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', start);
      stopAirportAmbience();
    };
  }, []); // eslint-disable-line

  const goLive = () => {
    dispatch({ type: 'SET_MODE', payload: 'live' });
    dispatch({ type: 'SET_SCREEN', payload: 'live-select' });
  };
  const goCity = () => {
    dispatch({ type: 'SET_MODE', payload: 'city' });
    dispatch({ type: 'SET_SCREEN', payload: 'city-select' });
  };
  const goPlan = () => dispatch({ type: 'SET_SCREEN', payload: 'flight-plan' });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-12 relative overflow-hidden">

      {/* Top right controls */}
      <div className="fixed top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2 z-20">
        <ThemeToggle />
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'stats' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-xl text-xs font-medium glass border border-white/10 text-[#94a3b8] hover:text-white transition-all"
        >
          <BarChart2 size={13} />
          <span className="hidden sm:inline">Statistics</span>
        </button>
      </div>

      {/* Logo block */}
      <motion.div
        custom={0}
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="flex flex-col items-center mb-5 sm:mb-14"
      >
        <div className="relative mb-3 sm:mb-6">
          <div className="absolute -inset-8 rounded-full bg-[#00b4d8]/8 blur-2xl pointer-events-none" />
          <motion.div
            animate={{ y: [-6, 5, -6], rotate: [-2, 2, -2] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-5xl sm:text-7xl select-none"
          >
            ✈️
          </motion.div>
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-1 sm:mb-2">
          <span className="text-white">Flo</span>
          <span className="text-glow-blue" style={{ color: '#00b4d8' }}>doro</span>
        </h1>
        <p className="text-[#475569] text-xs sm:text-sm tracking-[0.12em] sm:tracking-[0.2em] uppercase font-medium">
          Work · Fly · Rest
        </p>
      </motion.div>

      <motion.p
        custom={1}
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="text-[#94a3b8] text-center max-w-xs sm:max-w-sm mb-5 sm:mb-10 leading-relaxed text-xs sm:text-sm"
      >
        Pick a flight, start working. When you land, your break begins.
      </motion.p>

      {/* Mode cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 w-full max-w-3xl">

        {/* Live flight card */}
        <motion.button
          custom={2}
          initial="hidden"
          animate="show"
          variants={fadeUp}
          whileHover={{ y: -5, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={goLive}
          className="group relative rounded-2xl p-0.5 text-left transition-all duration-300"
          style={{ background: 'linear-gradient(135deg, rgba(0,180,216,0.15) 0%, rgba(0,180,216,0.03) 100%)' }}
        >
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: 'linear-gradient(135deg, rgba(0,180,216,0.25) 0%, rgba(0,180,216,0.05) 100%)' }} />
          <div className="relative rounded-[14px] glass p-4 sm:p-6 h-full">

            {/* Mobile: horizontal compact row */}
            <div className="flex items-center gap-3 sm:hidden">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(0,180,216,0.15)' }}>
                <Radio size={18} className="text-[#00b4d8]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-white">Live Flight</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(0,180,216,0.15)', color: '#00b4d8', border: '1px solid rgba(0,180,216,0.3)' }}>
                    LIVE
                  </span>
                </div>
                <p className="text-[11px] text-[#64748b]">Board a real aircraft with live tracking.</p>
              </div>
              <ChevronRight size={14} className="text-[#475569] flex-shrink-0" />
            </div>

            {/* Desktop: full vertical card */}
            <div className="hidden sm:block">
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,180,216,0.15)' }}>
                  <Radio size={20} className="text-[#00b4d8]" />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full tracking-wider"
                  style={{ background: 'rgba(0,180,216,0.15)', color: '#00b4d8', border: '1px solid rgba(0,180,216,0.3)' }}>
                  LIVE
                </span>
              </div>
              <div className="mb-4 h-8 relative overflow-hidden">
                <svg viewBox="0 0 120 30" className="absolute inset-0 w-full h-full opacity-40">
                  <path d="M5,20 Q30,8 60,12 Q90,16 115,5" fill="none" stroke="#00b4d8" strokeWidth="1.5"
                    strokeDasharray="4 3" className="opacity-60"/>
                  <circle cx="5" cy="20" r="2.5" fill="#48cae4" />
                  <circle cx="115" cy="5" r="3" fill="#f4a261">
                    <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/>
                  </circle>
                </svg>
                <motion.div
                  animate={{ x: ['5%', '90%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 0.5 }}
                  className="absolute text-sm"
                  style={{ top: '15%' }}
                >✈</motion.div>
              </div>
              <h2 className="text-base font-bold text-white mb-2">Live Flight</h2>
              <p className="text-xs text-[#64748b] leading-relaxed">
                Board a real aircraft in the air. Work with live position tracking.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs text-[#00b4d8] opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-200">
                <Zap size={11} /><span>Explore air traffic</span>
              </div>
            </div>

          </div>
        </motion.button>

        {/* City select card */}
        <motion.button
          custom={3}
          initial="hidden"
          animate="show"
          variants={fadeUp}
          whileHover={{ y: -5, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={goCity}
          className="group relative rounded-2xl p-0.5 text-left transition-all duration-300"
          style={{ background: 'linear-gradient(135deg, rgba(244,162,97,0.15) 0%, rgba(244,162,97,0.03) 100%)' }}
        >
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: 'linear-gradient(135deg, rgba(244,162,97,0.22) 0%, rgba(244,162,97,0.05) 100%)' }} />
          <div className="relative rounded-[14px] glass p-4 sm:p-6 h-full">

            {/* Mobile: horizontal compact row */}
            <div className="flex items-center gap-3 sm:hidden">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(244,162,97,0.15)' }}>
                <Navigation size={18} className="text-[#f4a261]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-white">Choose City</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(244,162,97,0.15)', color: '#f4a261', border: '1px solid rgba(244,162,97,0.3)' }}>
                    ROUTE
                  </span>
                </div>
                <p className="text-[11px] text-[#64748b]">Set your route. Short or classic Pomodoro.</p>
              </div>
              <ChevronRight size={14} className="text-[#475569] flex-shrink-0" />
            </div>

            {/* Desktop: full vertical card */}
            <div className="hidden sm:block">
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(244,162,97,0.15)' }}>
                  <Navigation size={20} className="text-[#f4a261]" />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full tracking-wider"
                  style={{ background: 'rgba(244,162,97,0.15)', color: '#f4a261', border: '1px solid rgba(244,162,97,0.3)' }}>
                  ROUTE
                </span>
              </div>
              <div className="mb-4 space-y-1">
                {[['IST', 'AYT', '25 min'], ['CDG', 'LHR', '30 min']].map(([o, d, t]) => (
                  <div key={o} className="flex items-center gap-2 text-[10px] opacity-50">
                    <span className="text-[#48cae4] font-mono">{o}</span>
                    <div className="flex-1 border-t border-dashed border-white/15" />
                    <span className="text-[#64748b]">{t}</span>
                    <div className="flex-1 border-t border-dashed border-white/15" />
                    <span className="text-[#f4a261] font-mono">{d}</span>
                  </div>
                ))}
              </div>
              <h2 className="text-base font-bold text-white mb-2">Choose City</h2>
              <p className="text-xs text-[#64748b] leading-relaxed">
                Set your own route. Short flights, classic Pomodoro or custom duration.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs text-[#f4a261] opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-200">
                <Zap size={11} /><span>Choose route, start working</span>
              </div>
            </div>

          </div>
        </motion.button>

        {/* Flight plan card */}
        <motion.button
          custom={4}
          initial="hidden"
          animate="show"
          variants={fadeUp}
          whileHover={{ y: -5, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={goPlan}
          className="group relative rounded-2xl p-0.5 text-left transition-all duration-300"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.03) 100%)' }}
        >
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0.05) 100%)' }} />
          <div className="relative rounded-[14px] glass p-4 sm:p-6 h-full">

            {/* Mobile: horizontal compact row */}
            <div className="flex items-center gap-3 sm:hidden">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.15)' }}>
                <CalendarDays size={18} style={{ color: '#8b5cf6' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-white">Flight Plan</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
                    FPL
                  </span>
                </div>
                <p className="text-[11px] text-[#64748b]">Plan your day as a multi-leg flight.</p>
              </div>
              <ChevronRight size={14} className="text-[#475569] flex-shrink-0" />
            </div>

            {/* Desktop: full vertical card */}
            <div className="hidden sm:block">
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(139,92,246,0.15)' }}>
                  <CalendarDays size={20} style={{ color: '#8b5cf6' }} />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full tracking-wider"
                  style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
                  FPL
                </span>
              </div>
              <div className="mb-4 space-y-1.5">
                {[['09:00','IST','FRA','45m'],['10:30','FRA','LHR','25m']].map(([t,o,d,dur]) => (
                  <div key={t} className="flex items-center gap-1.5 text-[10px]">
                    <span style={{ color: '#64748b', fontFamily: 'monospace', minWidth: 32 }}>{t}</span>
                    <span style={{ color: '#8b5cf6', fontFamily: 'monospace', fontWeight: 700 }}>{o}</span>
                    <div className="flex-1 border-t border-dashed" style={{ borderColor: 'rgba(139,92,246,0.2)' }} />
                    <span style={{ color: '#64748b' }}>{dur}</span>
                    <div className="flex-1 border-t border-dashed" style={{ borderColor: 'rgba(139,92,246,0.2)' }} />
                    <span style={{ color: '#8b5cf6', fontFamily: 'monospace', fontWeight: 700 }}>{d}</span>
                  </div>
                ))}
              </div>
              <h2 className="text-base font-bold text-white mb-2">Flight Plan</h2>
              <p className="text-xs text-[#64748b] leading-relaxed">
                Plan your day as a multi-leg flight. Each session automatically moves to the next.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100 transition-all duration-200"
                style={{ color: '#8b5cf6' }}>
                <Zap size={11} /><span>Create daily plan</span>
              </div>
            </div>

          </div>
        </motion.button>

      </div>

      {/* Footer */}
      <motion.div
        custom={5}
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="mt-8 sm:mt-14 flex flex-col items-center gap-3"
      >
        <div className="flex items-center gap-3">
          <a
            href="https://www.linkedin.com/in/mustafa-gul00/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border"
            style={{
              background: 'rgba(10,102,194,0.16)',
              borderColor: 'rgba(10,102,194,0.45)',
              color: '#60a5fa',
              textDecoration: 'none',
              minHeight: 44,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,102,194,0.28)'; e.currentTarget.style.borderColor = 'rgba(10,102,194,0.65)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(10,102,194,0.16)'; e.currentTarget.style.borderColor = 'rgba(10,102,194,0.45)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            Musti
          </a>

          <a
            href="https://buymeacoffee.com/mstfgul00q"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border"
            style={{
              background: 'rgba(255,216,20,0.13)',
              borderColor: 'rgba(255,216,20,0.42)',
              color: '#fde68a',
              textDecoration: 'none',
              minHeight: 44,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,216,20,0.24)'; e.currentTarget.style.borderColor = 'rgba(255,216,20,0.65)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,216,20,0.13)'; e.currentTarget.style.borderColor = 'rgba(255,216,20,0.42)'; }}
          >
            ☕ Buy me a coffee
          </a>
        </div>

        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#475569' }}>
          <Plane size={11} />
          <span>Created by Musti <span style={{ color: '#ef4444' }}>♥</span></span>
        </div>
      </motion.div>

    </div>
  );
}
