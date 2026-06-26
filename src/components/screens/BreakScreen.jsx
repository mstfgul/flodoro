import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { formatTime, formatDuration } from '../../utils/format';
import { playBreakEndChime } from '../../services/ambient';
import { startAirportAmbience, stopAirportAmbience } from '../../services/sounds';
import { notify } from '../../utils/notifications';

function BoardingPass({ session, isDark }) {
  if (!session) return null;
  const { origin, destination, flightData } = session;
  const callsign = flightData?.callsign || flightData?.icao24 || 'FL0001';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: 0.3, type: 'spring', damping: 18 }}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(0,180,216,0.12) 0%, rgba(7,11,26,0.9) 100%)'
          : 'linear-gradient(135deg, rgba(0,180,216,0.08) 0%, rgba(255,255,255,0.92) 100%)',
        border: `1px solid ${isDark ? 'rgba(0,180,216,0.25)' : 'rgba(0,180,216,0.2)'}`,
        borderRadius: 16,
        padding: '20px 24px',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Airline stripe */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, #00b4d8, #f4a261)',
        borderRadius: '16px 16px 0 0',
      }} />

      {/* Carrier + flight number */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">✈</span>
          <span className="font-mono text-xs font-bold tracking-widest" style={{ color: '#00b4d8' }}>
            {callsign.toUpperCase()}
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full border font-mono tracking-wider"
          style={{ color: '#f4a261', borderColor: 'rgba(244,162,97,0.3)', background: 'rgba(244,162,97,0.08)' }}>
          COMPLETED
        </span>
      </div>

      {/* Route */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 text-center">
          <div className="font-mono text-3xl font-black tracking-tight" style={{ color: isDark ? '#e0e6f0' : '#0f172a' }}>
            {origin?.code || '???'}
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: isDark ? '#64748b' : '#475569' }}>
            {origin?.city}
          </div>
        </div>

        <div className="flex-1 flex items-center gap-1 px-1">
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #00b4d8 30%, #00b4d8 70%, transparent)', opacity: 0.6 }} />
          <span className="text-base">🛬</span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #f4a261 30%, #f4a261 70%, transparent)', opacity: 0.4 }} />
        </div>

        <div className="flex-1 text-center">
          <div className="font-mono text-3xl font-black tracking-tight" style={{ color: isDark ? '#e0e6f0' : '#0f172a' }}>
            {destination?.code || '???'}
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: isDark ? '#64748b' : '#475569' }}>
            {destination?.city}
          </div>
        </div>
      </div>

      {/* Perforated divider */}
      <div style={{ borderTop: `1.5px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, margin: '0 -8px 12px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: -12, top: -6, width: 12, height: 12, borderRadius: '50%', background: isDark ? '#070b1a' : '#f0f8ff' }} />
        <div style={{ position: 'absolute', right: -12, top: -6, width: 12, height: 12, borderRadius: '50%', background: isDark ? '#070b1a' : '#f0f8ff' }} />
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center">
        <div>
          <div className="text-[10px]" style={{ color: '#64748b' }}>WORK</div>
          <div className="text-sm font-semibold font-mono" style={{ color: isDark ? '#e0e6f0' : '#0f172a' }}>
            {formatDuration(session.duration)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px]" style={{ color: '#64748b' }}>STATUS</div>
          <div className="text-xs font-semibold text-green-400">LANDED ✓</div>
        </div>
        <div className="text-right">
          <div className="text-[10px]" style={{ color: '#64748b' }}>{session.seat ? 'SEAT' : 'CLASS'}</div>
          <div className="text-sm font-semibold font-mono" style={{ color: isDark ? '#e0e6f0' : '#0f172a' }}>
            {session.seat || 'FOCUS'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function BreakScreen() {
  const { state, dispatch } = useApp();
  const { session, settings } = state;
  const totalBreak = settings.breakDuration * 60;
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState('running');
  const ref = useRef(null);
  const dingPlayed = useRef(false);
  const isDark = state.theme !== 'light';

  const soundEnabled = settings?.soundEnabled !== false;

  useEffect(() => {
    if (!dingPlayed.current) {
      dingPlayed.current = true;
      if (soundEnabled) setTimeout(() => startAirportAmbience(0.15), 600);
    }
    return () => stopAirportAmbience();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (status !== 'running') return;
    ref.current = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= totalBreak) {
          setStatus('completed');
          playBreakEndChime();
          notify('Break Over! 🔔', 'Ready for a new flight?');
          return totalBreak;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(ref.current);
  }, [status, totalBreak]);

  const remaining = Math.max(0, totalBreak - elapsed);
  const progress = totalBreak > 0 ? elapsed / totalBreak : 0;
  const newSession = useCallback(() => dispatch({ type: 'RESET' }), [dispatch]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 relative overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-5 z-10 w-full max-w-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 18, delay: 0.1 }}
          style={{ fontSize: 48, lineHeight: 1 }}
        >
          🛬
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
          <h1 style={{
            fontSize: 28, fontWeight: 700, marginBottom: 4,
            color: isDark ? '#DDE3F5' : '#0f172a',
            fontFamily: "'Space Grotesk', Inter, system-ui, sans-serif",
            letterSpacing: '-0.02em',
          }}>Landed.</h1>
          <p style={{ fontSize: 13, color: isDark ? '#3C4566' : '#475569' }}>
            {session ? formatDuration(session.duration) : ''} of focused flight
          </p>
        </motion.div>

        <BoardingPass session={session} isDark={isDark} />

        {/* Break timer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="rounded-2xl p-6 w-full"
          style={isDark
            ? { background: '#08101E', border: '1px solid #131D30' }
            : { background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.08)' }
          }
        >
          {status === 'completed' ? (
            <div className="text-center">
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔔</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#E8A030', fontFamily: "'Space Grotesk', Inter, system-ui, sans-serif" }}>Break over.</div>
              <div style={{ fontSize: 13, marginTop: 4, color: isDark ? '#3C4566' : '#475569' }}>Ready for a new flight?</div>
            </div>
          ) : (
            <div className="text-center">
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.22em', color: '#2A3450', textTransform: 'uppercase', marginBottom: 10 }}>BREAK TIME</div>
              <div className="timer-display" style={{ fontSize: 68, fontWeight: 700, color: '#00b4d8', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 16 }}>
                {formatTime(remaining)}
              </div>
              <div className="w-48 h-1.5 rounded-full overflow-hidden mx-auto"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }}>
                <motion.div
                  className="h-full bg-[#00b4d8] rounded-full"
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </div>
              <div className="flex gap-3 mt-4 justify-center">
                {status === 'running' ? (
                  <button
                    onClick={() => { setStatus('paused'); clearInterval(ref.current); }}
                    className="text-xs transition-colors px-3 py-1 rounded-lg hover:bg-white/5"
                    style={{ color: '#64748b' }}
                  >
                    ⏸ Pause
                  </button>
                ) : (
                  <button
                    onClick={() => setStatus('running')}
                    className="text-xs transition-colors px-3 py-1 rounded-lg hover:bg-white/5"
                    style={{ color: '#00b4d8' }}
                  >
                    ▶ Resume
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Next flight CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex flex-col sm:flex-row gap-3 w-full"
        >
          <Button onClick={newSession} variant="primary" size="lg" className="flex-1">
            ✈ Connecting Flight
          </Button>
          <Button
            onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'home' })}
            variant="secondary"
            size="lg"
            className="flex-1"
          >
            Home
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
