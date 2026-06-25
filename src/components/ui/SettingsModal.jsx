import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Map, Clock, Volume2, Bell, Layers, Moon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { requestNotifyPermission } from '../../utils/notifications';

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        position: 'relative',
        width: 44,
        height: 24,
        borderRadius: 12,
        background: value ? '#00b4d8' : 'rgba(255,255,255,0.12)',
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: value ? 23 : 3,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

function Section({ icon: Icon, label, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <Icon size={13} color="#00b4d8" />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />;
}

const BREAK_OPTIONS = [3, 5, 10, 15, 20];

export function SettingsModal({ open, onClose }) {
  const { state, dispatch } = useApp();
  const { settings } = state;

  const update = (key, value) => dispatch({ type: 'UPDATE_SETTINGS', payload: { [key]: value } });

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleNotifToggle = async () => {
    if (!settings.notifEnabled) {
      const granted = await requestNotifyPermission();
      if (granted) update('notifEnabled', true);
    } else {
      update('notifEnabled', false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(6px)',
              zIndex: 9998,
            }}
          />

          {/* Centering wrapper — flex handles position, motion.div handles animation */}
          <div style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'none',
            padding: '16px',
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              style={{
                pointerEvents: 'all',
                width: '100%',
                maxWidth: 480,
                maxHeight: '90vh',
                overflowY: 'auto',
                background: 'rgba(8,12,28,0.98)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 20,
                boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,180,216,0.08) inset',
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 24px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: 'rgba(0,180,216,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Layers size={15} color="#00b4d8" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Settings</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>Flight preferences</div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#64748b',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* ── Mola Süresi ── */}
                <Section icon={Clock} label="Break Duration">
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {BREAK_OPTIONS.map(min => (
                      <button
                        key={min}
                        onClick={() => update('breakDuration', min)}
                        style={{
                          flex: 1, padding: '8px 0',
                          borderRadius: 10,
                          fontSize: 13, fontWeight: 600,
                          cursor: 'pointer',
                          border: settings.breakDuration === min
                            ? '1px solid rgba(0,180,216,0.6)'
                            : '1px solid rgba(255,255,255,0.08)',
                          background: settings.breakDuration === min
                            ? 'rgba(0,180,216,0.18)'
                            : 'rgba(255,255,255,0.04)',
                          color: settings.breakDuration === min ? '#00b4d8' : '#64748b',
                          transition: 'all 0.15s',
                        }}
                      >
                        {min}<span style={{ fontSize: 10, marginLeft: 2, opacity: 0.7 }}>m</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#475569' }}>Custom:</span>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={settings.breakDuration}
                      onChange={e => update('breakDuration', Math.max(1, Math.min(120, parseInt(e.target.value) || 5)))}
                      style={{
                        width: 64, padding: '6px 10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8, fontSize: 13,
                        color: '#e0e6f0', textAlign: 'center',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 12, color: '#475569' }}>min</span>
                  </div>
                </Section>

                <Divider />

                {/* ── Harita Modu ── */}
                <Section icon={Map} label="Map Mode">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      { value: 'animated', label: 'Animated', sub: 'Simulated route', icon: '🛫' },
                      { value: 'realtime', label: 'Real-time', sub: 'Live position', icon: '📡' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => update('mapView', opt.value)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 12,
                          textAlign: 'left',
                          cursor: 'pointer',
                          border: settings.mapView === opt.value
                            ? '1px solid rgba(0,180,216,0.5)'
                            : '1px solid rgba(255,255,255,0.07)',
                          background: settings.mapView === opt.value
                            ? 'rgba(0,180,216,0.12)'
                            : 'rgba(255,255,255,0.03)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontSize: 18, marginBottom: 6 }}>{opt.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: settings.mapView === opt.value ? '#00b4d8' : '#e0e6f0' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{opt.sub}</div>
                      </button>
                    ))}
                  </div>
                </Section>

                <Divider />

                {/* ── Ses & Bildirimler ── */}
                <Section icon={Volume2} label="Sound & Notifications">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      {
                        key: 'soundEnabled',
                        icon: '🎵',
                        label: 'Ambient Sound',
                        sub: 'Engine, landing chime, break alert',
                        onToggle: () => update('soundEnabled', !settings.soundEnabled),
                        value: settings.soundEnabled,
                      },
                      {
                        key: 'notifEnabled',
                        icon: '🔔',
                        label: 'Notifications',
                        sub: 'System notification at flight & break end',
                        onToggle: handleNotifToggle,
                        value: settings.notifEnabled,
                      },
                    ].map(row => (
                      <div
                        key={row.key}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 14px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 18 }}>{row.icon}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e6f0' }}>{row.label}</div>
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>{row.sub}</div>
                          </div>
                        </div>
                        <Toggle value={!!row.value} onChange={row.onToggle} />
                      </div>
                    ))}
                  </div>
                </Section>

                <Divider />

                {/* ── Oturum Davranışı ── */}
                <Section icon={Moon} label="Session Behavior">
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>⚡</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e6f0' }}>Auto-start break</div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
                          Start break timer when flight ends
                        </div>
                      </div>
                    </div>
                    <Toggle
                      value={settings.autoStartBreak}
                      onChange={v => update('autoStartBreak', v)}
                    />
                  </div>
                </Section>

              </div>

              {/* Footer */}
              <div style={{
                padding: '14px 24px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 11, color: '#334155' }}>Flodoro · v1.0</span>
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 10,
                    background: 'rgba(0,180,216,0.15)',
                    border: '1px solid rgba(0,180,216,0.3)',
                    color: '#00b4d8',
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(0,180,216,0.25)'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'rgba(0,180,216,0.15)'; }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
