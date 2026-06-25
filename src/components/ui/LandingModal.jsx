import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from '../../utils/format';
import { Button } from './Button';

export function LandingModal({ open, elapsed, onBreak, onStay }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 2000 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 32px)', maxWidth: 360,
              zIndex: 2001,
              background: 'rgba(4,7,18,0.97)',
              border: '1px solid rgba(0,180,216,0.25)',
              borderRadius: 14,
              padding: '20px 22px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,180,216,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 28 }}>🛬</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>Landed!</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                  Flight time:{' '}
                  <span style={{ color: '#00b4d8', fontFamily: 'monospace', fontWeight: 600 }}>
                    {formatTime(elapsed)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onBreak}
                style={{
                  flex: 1, height: 48, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, rgba(0,180,216,0.25), rgba(0,180,216,0.12))',
                  color: '#00b4d8', fontWeight: 700, fontSize: 12,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,180,216,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,180,216,0.25), rgba(0,180,216,0.12))'; }}
              >
                ☕ Take a Break
              </button>
              <button
                onClick={onStay}
                style={{
                  flex: 1, height: 48, borderRadius: 10, cursor: 'pointer',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#64748b', fontWeight: 600, fontSize: 12,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = '#94a3b8'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#64748b'; }}
              >
                🛫 Stay Onboard
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
