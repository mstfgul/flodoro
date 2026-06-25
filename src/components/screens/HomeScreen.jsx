import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Navigation, Plane, BarChart2, Zap, CalendarDays } from 'lucide-react';
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

    // Try immediately — if browser blocks autoplay, wait for first touch/click
    const t = setTimeout(() => {
      startAirportAmbience(0.18).catch(() => {
        // Autoplay blocked: start on first interaction instead
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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Top right controls */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-20">
        <ThemeToggle />
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'stats' })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium glass border border-white/10 text-[#94a3b8] hover:text-white transition-all"
        >
          <BarChart2 size={13} />
          İstatistikler
        </button>
      </div>

      {/* Logo block */}
      <motion.div
        custom={0}
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="flex flex-col items-center mb-14"
      >
        <div className="relative mb-6">
          {/* Ambient glow */}
          <div className="absolute -inset-8 rounded-full bg-[#00b4d8]/8 blur-2xl pointer-events-none" />
          <motion.div
            animate={{ y: [-6, 5, -6], rotate: [-2, 2, -2] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-7xl select-none"
          >
            ✈️
          </motion.div>
        </div>

        <h1 className="text-6xl font-bold tracking-tight mb-2">
          <span className="text-white">Flo</span>
          <span
            className="text-glow-blue"
            style={{ color: '#00b4d8' }}
          >
            doro
          </span>
        </h1>
        <p className="text-[#475569] text-sm tracking-[0.2em] uppercase font-medium">
          Çalış · Uç · Mola Ver
        </p>
      </motion.div>

      <motion.p
        custom={1}
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="text-[#94a3b8] text-center max-w-sm mb-10 leading-relaxed text-sm"
      >
        Bir uçuş seç, çalışmaya başla. İniş yapınca molan hazır.
      </motion.p>

      {/* Mode cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
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
          style={{
            background: 'linear-gradient(135deg, rgba(0,180,216,0.15) 0%, rgba(0,180,216,0.03) 100%)',
          }}
        >
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: 'linear-gradient(135deg, rgba(0,180,216,0.25) 0%, rgba(0,180,216,0.05) 100%)' }}
          />
          <div className="relative rounded-[14px] glass p-6 h-full">
            <div className="flex items-start justify-between mb-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(0,180,216,0.15)' }}>
                <Radio size={20} className="text-[#00b4d8]" />
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full tracking-wider"
                style={{ background: 'rgba(0,180,216,0.15)', color: '#00b4d8', border: '1px solid rgba(0,180,216,0.3)' }}>
                CANLI
              </span>
            </div>

            {/* Mini animated flight path */}
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

            <h2 className="text-base font-bold text-white mb-2">Gerçek Uçuş</h2>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Şu an havada olan bir uçağa bin. Gerçek zamanlı konum takibi ile çalış.
            </p>
            <div className="mt-4 flex items-center gap-1 text-xs text-[#00b4d8] opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-200">
              <Zap size={11} /><span>Hava trafiğini keşfet</span>
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
          style={{
            background: 'linear-gradient(135deg, rgba(244,162,97,0.15) 0%, rgba(244,162,97,0.03) 100%)',
          }}
        >
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: 'linear-gradient(135deg, rgba(244,162,97,0.22) 0%, rgba(244,162,97,0.05) 100%)' }}
          />
          <div className="relative rounded-[14px] glass p-6 h-full">
            <div className="flex items-start justify-between mb-5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(244,162,97,0.15)' }}>
                <Navigation size={20} className="text-[#f4a261]" />
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full tracking-wider"
                style={{ background: 'rgba(244,162,97,0.15)', color: '#f4a261', border: '1px solid rgba(244,162,97,0.3)' }}>
                ROTA
              </span>
            </div>

            {/* Mini route options */}
            <div className="mb-4 space-y-1">
              {[['IST', 'AYT', '25 dk'], ['CDG', 'LHR', '30 dk']].map(([o, d, t]) => (
                <div key={o} className="flex items-center gap-2 text-[10px] opacity-50">
                  <span className="text-[#48cae4] font-mono">{o}</span>
                  <div className="flex-1 border-t border-dashed border-white/15" />
                  <span className="text-[#64748b]">{t}</span>
                  <div className="flex-1 border-t border-dashed border-white/15" />
                  <span className="text-[#f4a261] font-mono">{d}</span>
                </div>
              ))}
            </div>

            <h2 className="text-base font-bold text-white mb-2">Şehir Seç</h2>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Kendi rotanı belirle. Kısa uçuşlar, klasik Pomodoro veya özel süre.
            </p>
            <div className="mt-4 flex items-center gap-1 text-xs text-[#f4a261] opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-200">
              <Zap size={11} /><span>Rota seç, çalışmaya başla</span>
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
          <div className="relative rounded-[14px] glass p-6 h-full">
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

            {/* Mini flight plan */}
            <div className="mb-4 space-y-1.5">
              {[['09:00','IST','FRA','45dk'],['10:30','FRA','LHR','25dk']].map(([t,o,d,dur]) => (
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

            <h2 className="text-base font-bold text-white mb-2">Uçuş Planı</h2>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Günü çoklu bacaklı bir uçuş olarak planla. Her seans otomatik sıradakine geçer.
            </p>
            <div className="mt-4 flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100 transition-all duration-200"
              style={{ color: '#8b5cf6' }}>
              <Zap size={11} /><span>Günlük plan oluştur</span>
            </div>
          </div>
        </motion.button>
      </div>

      {/* Footer hint */}
      <motion.div
        custom={4}
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="mt-14 flex items-center gap-5 text-xs text-[#334155]"
      >
        <div className="flex items-center gap-1.5">
          <Plane size={11} />
          <span>OpenSky Network</span>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <span>OpenStreetMap + CARTO</span>
        <div className="w-px h-3 bg-white/10" />
        <span>Ücretsiz API</span>
      </motion.div>
    </div>
  );
}
