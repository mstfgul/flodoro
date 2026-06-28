import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, X, Check, AlertCircle, Zap,
  Users, BarChart2, Plus, TrendingUp, ChevronRight,
  Home, Plane
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AIRCRAFT_CATALOG, getCatalogEntry, CATEGORY_LABELS } from '../../data/aircraftCatalog';

const CAT = CATEGORY_LABELS;

const EARNED_MILESTONES = [
  { minutes: 0,     slots: 3,  label: 'Startup' },
  { minutes: 360,   slots: 4,  label: '6h focused' },
  { minutes: 1500,  slots: 6,  label: '25h milestone' },
  { minutes: 6000,  slots: 8,  label: '100h pilot' },
  { minutes: 15000, slots: 10, label: '250h aviator' },
  { minutes: 40000, slots: 13, label: '666h legend' },
];

// Lightweight theme context so sub-components don't need T threaded as a prop
const TC = createContext(null);
const useT = () => useContext(TC);

function fmt(n) { return (n ?? 0).toLocaleString(); }

// ─── Smooth animated number ───────────────────────────────────────────────────
function AnimNum({ value, style }) {
  const [disp, setDisp] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const from = ref.current; ref.current = value;
    if (from === value) return;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / 600, 1);
      const e = p < .5 ? 2*p*p : -1+(4-2*p)*p;
      setDisp(Math.round(from + (value - from) * e));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span style={style}>{fmt(disp)}</span>;
}

// ─── Scan line that sweeps down aircraft cards ────────────────────────────────
function ScanLine({ color }) {
  return (
    <motion.div
      style={{
        position: 'absolute', left: 0, right: 0, height: 60, pointerEvents: 'none', zIndex: 2,
        background: `linear-gradient(to bottom, transparent, ${color}22, transparent)`,
      }}
      animate={{ top: [-60, 240] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: 'linear', repeatDelay: 5 }}
    />
  );
}

// ─── Pulsing "operational" dot ────────────────────────────────────────────────
function LiveDot({ color = '#22c55e' }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 10, height: 10 }}>
      <motion.span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, opacity: 0.3 }}
        animate={{ scale: [1, 2.2, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }} />
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'block' }} />
    </span>
  );
}

// ─── Owned aircraft bay strip (photo hero) ────────────────────────────────────
function BayStrip({ index, aircraft, onView }) {
  const T = useT();
  const def = getCatalogEntry(aircraft.aircraft_code);
  const cat = def ? CAT[def.category] : CAT.propeller;

  return (
    <motion.div
      onClick={() => onView(def)}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: 'spring', damping: 20 }}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 18,
        height: 176, cursor: 'pointer',
        border: `1px solid ${cat.color}35`,
        boxShadow: `0 4px 32px ${cat.color}10`,
      }}
      whileHover={{ scale: 1.015, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.985 }}
    >
      {/* Photo background */}
      {def?.photo && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${def.photo})`,
          backgroundSize: 'cover', backgroundPosition: 'center 35%',
          filter: 'brightness(0.28) saturate(0.7)',
        }} />
      )}

      {/* Category color tint from left */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(110deg, ${cat.color}18 0%, transparent 55%)`,
      }} />

      {/* Dark vignette on right — adapts to theme bg */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(90deg, transparent 30%, ${T.vignette}cc 85%, ${T.vignette})`,
      }} />

      {/* Giant floor-painted bay number */}
      <div style={{
        position: 'absolute', left: 6, bottom: -18,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 130, fontWeight: 900, color: '#fff',
        opacity: 0.045, lineHeight: 1, userSelect: 'none', letterSpacing: -6,
      }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* Scan line effect */}
      <ScanLine color={cat.color} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 3, height: '100%', padding: '13px 16px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700,
            letterSpacing: 2.5, color: cat.color, opacity: 0.9,
          }}>
            BAY {String(index + 1).padStart(2, '0')} · {cat.label.toUpperCase()}
          </span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '4px 9px',
            backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <LiveDot />
            <span style={{ fontSize: 8, color: '#22c55e', fontWeight: 700, letterSpacing: 1 }}>ACTIVE</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: -0.3, lineHeight: 1.1, textShadow: '0 2px 16px rgba(0,0,0,0.9)' }}>
            {def?.name ?? aircraft.aircraft_code}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 7 }}>
            {[
              def?.maxSpeed && { label: 'SPEED', val: def.maxSpeed },
              def?.maxPassengers && { label: 'PAX', val: def.maxPassengers },
              def?.introduced && { label: 'YEAR', val: def.introduced },
            ].filter(Boolean).map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: 'rgba(255,255,255,0.28)', letterSpacing: 1.5 }}>{label}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: cat.color, borderRadius: '18px 0 0 18px' }} />
    </motion.div>
  );
}

// ─── Vacant bay ───────────────────────────────────────────────────────────────
function VacantBay({ index }) {
  const T = useT();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      style={{
        borderRadius: 18, height: 88, overflow: 'hidden',
        border: `1px dashed ${T.border}`,
        background: T.isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)',
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px',
        position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute', left: 6, bottom: -14,
        fontFamily: "'JetBrains Mono',monospace", fontSize: 80, fontWeight: 900,
        color: T.isDark ? '#fff' : '#000', opacity: 0.02, lineHeight: 1, userSelect: 'none',
      }}>
        {String(index + 1).padStart(2, '0')}
      </div>
      <div style={{ width: 3, alignSelf: 'stretch', background: T.border, borderRadius: 2 }} />
      <div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: T.textFaint, letterSpacing: 3, fontWeight: 700 }}>
          BAY {String(index + 1).padStart(2, '0')}
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>Open slot — claim an aircraft</div>
      </div>
    </motion.div>
  );
}

// ─── Buy-slot card ────────────────────────────────────────────────────────────
function BuySlotStrip({ index, cost, availableParts, onBuy, buying }) {
  const T = useT();
  const can = availableParts >= cost;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      style={{
        borderRadius: 18, height: 88, overflow: 'hidden',
        border: `1px dashed ${can ? '#E8A03060' : T.border}`,
        background: can ? 'rgba(232,160,48,0.04)' : T.isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px',
        position: 'relative',
      }}
    >
      {can && (
        <motion.div style={{
          position: 'absolute', inset: 0, borderRadius: 18,
          background: 'linear-gradient(90deg, #E8A03008, transparent)',
          pointerEvents: 'none',
        }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 3, alignSelf: 'stretch', minHeight: 40, background: can ? '#E8A030' : T.border, borderRadius: 2 }} />
        <div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: can ? '#E8A030' : T.textFaint, letterSpacing: 3, fontWeight: 700 }}>
            BAY {String(index + 1).padStart(2, '0')} · EXPANSION
          </div>
          <div style={{ fontSize: 11, color: can ? '#c0a060' : T.textMuted, marginTop: 2 }}>
            {can ? 'Ready to unlock' : `Need ${fmt(cost - availableParts)} more parts`}
          </div>
        </div>
      </div>
      <motion.button
        onClick={onBuy}
        disabled={!can || buying}
        whileTap={can ? { scale: 0.93 } : {}}
        style={{
          padding: '9px 18px', borderRadius: 12, border: 'none',
          background: can ? 'linear-gradient(135deg, #E8A030, #d47b10)' : T.border,
          color: can ? '#07111f' : T.textMuted,
          fontSize: 11, fontWeight: 800, cursor: can ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          opacity: buying ? 0.6 : 1, letterSpacing: 0.3,
        }}
      >
        {buying ? '…' : <><span style={{ fontFamily: "'JetBrains Mono',monospace" }}>⚙ {fmt(cost)}</span>&nbsp;<Plus size={10} /></>}
      </motion.button>
    </motion.div>
  );
}

// ─── Catalog card (photo + progress) ─────────────────────────────────────────
function CatalogCard({ def, isOwned, availableParts, onSelect, index }) {
  const T = useT();
  const cat = CAT[def.category];
  const progress = Math.min(1, availableParts / def.partsRequired);
  const can = availableParts >= def.partsRequired;

  return (
    <motion.div
      onClick={() => onSelect(def)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 16, height: 124, cursor: 'pointer',
        border: `1px solid ${isOwned ? cat.color + '50' : can ? cat.color + '22' : T.border}`,
      }}
      whileHover={{ scale: 1.01, transition: { duration: 0.12 } }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Photo */}
      {def.photo && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${def.photo})`,
          backgroundSize: 'cover', backgroundPosition: 'center 30%',
          filter: isOwned
            ? 'brightness(0.3) saturate(0.65)'
            : can ? 'brightness(0.22) saturate(0.5)'
            : `brightness(${T.isDark ? 0.1 : 0.15}) saturate(0)`,
        }} />
      )}

      {/* Category tint + right fade to bg */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(100deg, ${cat.color}${isOwned ? '20' : '0a'} 0%, transparent 55%, ${T.vignette}dd 90%)`,
      }} />

      {/* Surface for text area when no photo */}
      {!def.photo && (
        <div style={{ position: 'absolute', inset: 0, background: T.surface }} />
      )}

      {/* Left bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: isOwned ? cat.color : can ? cat.color + '55' : T.border,
        borderRadius: '16px 0 0 16px',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1, height: '100%', padding: '12px 14px 10px 18px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: cat.color, letterSpacing: 2, fontWeight: 700, marginBottom: 3 }}>
              {cat.label.toUpperCase()} · {def.country}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.15,
              color: isOwned ? '#fff' : can ? '#ddeeff' : (T.isDark ? '#3a4a5a' : T.textMuted),
            }}>
              {def.name}
            </div>
            <div style={{ fontSize: 9, color: T.textFaint, marginTop: 2 }}>{def.manufacturer}</div>
          </div>
          <div style={{ flexShrink: 0 }}>
            {isOwned ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#22c55e18', border: '1px solid #22c55e30', borderRadius: 20, padding: '4px 10px' }}>
                <Check size={9} style={{ color: '#22c55e' }} />
                <span style={{ fontSize: 8, fontWeight: 700, color: '#22c55e', letterSpacing: 1 }}>OWNED</span>
              </div>
            ) : can ? (
              <div style={{ background: cat.color + '20', border: `1px solid ${cat.color}40`, borderRadius: 20, padding: '4px 10px', fontSize: 8, fontWeight: 700, color: cat.color, letterSpacing: 1 }}>
                ACQUIRE
              </div>
            ) : (
              <ChevronRight size={14} style={{ color: T.textFaint, marginTop: 4 }} />
            )}
          </div>
        </div>

        {!isOwned && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, color: can ? cat.color : T.textFaint }}>
                ⚙ {fmt(def.partsRequired)}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: T.textFaint }}>
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div style={{ height: 3, background: T.surface2, borderRadius: 2, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: index * 0.04 + 0.1 }}
                style={{ height: '100%', borderRadius: 2, background: can ? `linear-gradient(90deg, ${cat.color}, ${def.accent ?? cat.color})` : T.textFaint }}
              />
            </div>
          </div>
        )}
        {isOwned && (
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: T.textFaint }}>
            {[def.maxSpeed, def.range].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Aircraft detail modal ────────────────────────────────────────────────────
function AircraftModal({ def, isOwned, availableParts, onClaim, onClose, claiming, error }) {
  const T = useT();
  if (!def) return null;
  const cat = CAT[def.category];
  const progress = Math.min(1, availableParts / def.partsRequired);
  const can = availableParts >= def.partsRequired;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 260 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 500,
          background: T.bg,
          borderRadius: '24px 24px 0 0',
          overflow: 'hidden',
          boxShadow: `0 -24px 80px ${cat.color}25`,
          border: `1px solid ${cat.color}25`, borderBottom: 'none',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Hero photo */}
        <div style={{ position: 'relative', height: 210, flexShrink: 0, overflow: 'hidden' }}>
          {def.photo && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${def.photo})`,
              backgroundSize: 'cover', backgroundPosition: 'center 30%',
              filter: 'brightness(0.45) saturate(0.8)',
            }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${cat.color}28, transparent 60%)` }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, transparent 30%, ${T.bg})` }} />

          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%',
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}>
            <X size={15} />
          </button>

          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 36, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />

          <div style={{ position: 'absolute', bottom: 18, left: 20 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: cat.color, letterSpacing: 3, fontWeight: 700, marginBottom: 4 }}>
              {cat.label.toUpperCase()} · {def.country} · {def.introduced}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5, lineHeight: 1.1, textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>
              {def.name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{def.manufacturer}</div>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'MAX SPEED', val: def.maxSpeed ?? '—' },
              { label: 'PASSENGERS', val: def.maxPassengers ?? '—' },
              { label: 'RANGE', val: def.range ?? '—' },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: T.surface2, borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: T.textFaint, letterSpacing: 1.5, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          {def.description && (
            <div style={{ marginBottom: 16, padding: '12px 14px', background: T.surface2, borderRadius: 12, border: `1px solid ${T.border}` }}>
              <p style={{ margin: 0, fontSize: 12, color: T.textMuted, lineHeight: 1.65, fontStyle: 'italic' }}>"{def.description}"</p>
              {def.fact && <p style={{ margin: '8px 0 0', fontSize: 11, color: T.textFaint, lineHeight: 1.6 }}>⚡ {def.fact}</p>}
            </div>
          )}

          {/* Acquire or owned */}
          {isOwned ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#22c55e10', border: '1px solid #22c55e22', borderRadius: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#22c55e18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={18} style={{ color: '#22c55e' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>In your hangar</div>
                <div style={{ fontSize: 11, color: T.textFaint }}>Registered & operational</div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 800, color: can ? cat.color : T.textFaint }}>
                    ⚙ {fmt(def.partsRequired)}
                  </span>
                  <span style={{ fontSize: 10, color: T.textFaint, marginLeft: 6 }}>parts required</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: T.textFaint, marginBottom: 1 }}>You have</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: '#00b4d8' }}>⚙ {fmt(availableParts)}</div>
                </div>
              </div>

              <div style={{ height: 6, background: T.surface2, borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ height: '100%', borderRadius: 3, background: can ? `linear-gradient(90deg, ${cat.color}, ${def.accent ?? cat.color})` : T.textFaint }}
                />
              </div>

              {error && (
                <div style={{ marginBottom: 12, padding: '9px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 11, color: '#ef4444', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <AlertCircle size={13} />{error}
                </div>
              )}

              <motion.button
                onClick={onClaim}
                disabled={!can || claiming}
                whileTap={can ? { scale: 0.97 } : {}}
                style={{
                  width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                  background: can
                    ? `linear-gradient(135deg, ${cat.color}, ${def.accent ?? cat.color + 'bb'})`
                    : T.border,
                  color: can ? '#fff' : T.textMuted,
                  fontSize: 14, fontWeight: 800, cursor: can ? 'pointer' : 'not-allowed',
                  letterSpacing: 0.3, opacity: claiming ? 0.7 : 1,
                  fontFamily: "'JetBrains Mono',monospace",
                }}
              >
                {claiming ? 'ACQUIRING…'
                  : can ? `ACQUIRE — ⚙ ${fmt(def.partsRequired)}`
                  : `NEED ${fmt(def.partsRequired - availableParts)} MORE PARTS`}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Category filter pills ────────────────────────────────────────────────────
const ALL_CATS = ['all', 'propeller', 'twin', 'regional', 'narrowbody', 'widebody', 'jumbo', 'supersonic'];

function CategoryPills({ active, onChange }) {
  const T = useT();
  return (
    <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
      {ALL_CATS.map(c => {
        const isActive = active === c;
        const col = c === 'all' ? '#00b4d8' : (CAT[c]?.color ?? '#fff');
        return (
          <motion.button
            key={c}
            onClick={() => onChange(c)}
            whileTap={{ scale: 0.94 }}
            style={{
              flexShrink: 0, padding: '6px 13px', borderRadius: 20,
              border: `1px solid ${isActive ? col + '60' : T.border}`,
              background: isActive ? col + '18' : 'transparent',
              color: isActive ? col : T.textFaint,
              fontSize: 9, fontWeight: 700, letterSpacing: 1.5, cursor: 'pointer',
              fontFamily: "'JetBrains Mono',monospace", whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {c === 'all' ? 'ALL' : CAT[c]?.label.toUpperCase()}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Expand Tab ───────────────────────────────────────────────────────────────
function ExpandTab({ hangar, onBuySlot, buying, slotError }) {
  const T = useT();
  const earnedSlots = hangar?.earned_slots ?? 3;
  const purchasedSlots = hangar?.purchased_slots ?? 0;
  const capacity = hangar?.capacity ?? 3;
  const nextSlotCost = hangar?.next_slot_cost ?? 200;
  const totalMinutes = hangar?.total_minutes ?? 0;
  const available = hangar?.available_parts ?? 0;
  const can = available >= nextSlotCost;
  const COSTS = [200, 600, 1500, 3500, 8000, 18000];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Big capacity numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'EARNED', value: earnedSlots, color: '#00b4d8', sub: 'from focus' },
          { label: 'PURCHASED', value: purchasedSlots, color: '#E8A030', sub: 'with parts' },
          { label: 'TOTAL', value: capacity, color: '#8b5cf6', sub: 'capacity' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{ background: T.surface2, borderRadius: 14, padding: '14px 10px', textAlign: 'center', border: `1px solid ${color}18` }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: T.textFaint, letterSpacing: 2, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 9, color: T.textFaint, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Buy next slot */}
      <div style={{ background: T.surface2, border: `1px solid ${can ? '#E8A03030' : T.border}`, borderRadius: 16, padding: 16, overflow: 'hidden', position: 'relative' }}>
        {can && (
          <motion.div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(135deg, rgba(232,160,48,0.04), transparent)',
          }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }} />
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#E8A030', letterSpacing: 2.5, marginBottom: 12, fontWeight: 700 }}>
            EXPANSION OFFICE — NEXT BAY
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Bay #{capacity + 1}</div>
              <div style={{ fontSize: 10, color: T.textFaint, marginTop: 1 }}>{purchasedSlots} bought · price escalates</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 900, color: can ? '#E8A030' : T.textFaint }}>⚙ {fmt(nextSlotCost)}</div>
              <div style={{ fontSize: 8, color: T.textFaint, marginTop: 1 }}>have: {fmt(available)}</div>
            </div>
          </div>

          <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
            <motion.div
              animate={{ width: `${Math.min(100, (available / nextSlotCost) * 100)}%` }}
              transition={{ duration: 0.9 }}
              style={{ height: '100%', borderRadius: 3, background: can ? 'linear-gradient(90deg, #E8A030, #f5c060)' : T.textFaint }}
            />
          </div>

          {slotError && (
            <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 11, color: '#ef4444' }}>
              {slotError}
            </div>
          )}

          <motion.button
            onClick={onBuySlot}
            disabled={!can || buying}
            whileTap={can ? { scale: 0.97 } : {}}
            style={{
              width: '100%', padding: '13px', borderRadius: 13, border: 'none',
              background: can ? 'linear-gradient(135deg, #E8A030, #d47b10)' : T.border,
              color: can ? '#07111f' : T.textMuted,
              fontSize: 13, fontWeight: 800, cursor: can ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: buying ? 0.7 : 1, letterSpacing: 0.3,
              fontFamily: can ? "'JetBrains Mono',monospace" : undefined,
            }}
          >
            {buying ? 'EXPANDING…'
              : can ? `EXPAND — ⚙ ${fmt(nextSlotCost)}`
              : `Need ${fmt(nextSlotCost - available)} more parts`}
          </motion.button>

          {/* Price ladder */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: T.border, letterSpacing: 2, marginBottom: 8 }}>COST SCHEDULE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {COSTS.map((c, i) => {
                const past = i < purchasedSlots;
                const curr = i === purchasedSlots;
                return (
                  <div key={i} style={{
                    padding: '4px 9px', borderRadius: 7,
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 700,
                    background: past ? '#22c55e12' : curr ? '#E8A03012' : T.surface2,
                    border: `1px solid ${past ? '#22c55e22' : curr ? '#E8A03025' : T.border}`,
                    color: past ? '#22c55e' : curr ? '#E8A030' : T.textFaint,
                  }}>
                    {past ? '✓' : `⚙${fmt(c)}`}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Earned milestones */}
      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#00b4d8', letterSpacing: 2.5, marginBottom: 14, fontWeight: 700 }}>
          FOCUS MILESTONES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {EARNED_MILESTONES.map((m, i) => {
            const next = EARNED_MILESTONES[i + 1];
            const reached = totalMinutes >= m.minutes;
            const active = reached && (!next || totalMinutes < next.minutes);
            return (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: reached ? 'rgba(0,180,216,0.15)' : T.surface2,
                    border: `2px solid ${reached ? '#00b4d8' : T.border}`,
                  }}>
                    {reached ? <Check size={9} style={{ color: '#00b4d8' }} /> : null}
                  </div>
                  {i < EARNED_MILESTONES.length - 1 && (
                    <div style={{ flex: 1, width: 2, background: reached ? '#00b4d815' : T.border, marginTop: 2, minHeight: 18 }} />
                  )}
                </div>

                <div style={{ flex: 1, paddingTop: 8, paddingBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: reached ? T.text : T.textFaint }}>
                        {m.slots} bays
                      </span>
                      <span style={{ fontSize: 9, color: T.textFaint, marginLeft: 6, fontFamily: "'JetBrains Mono',monospace" }}>
                        {m.label}
                      </span>
                    </div>
                    {active && (
                      <span style={{ fontSize: 8, background: 'rgba(0,180,216,0.12)', color: '#00b4d8', border: '1px solid rgba(0,180,216,0.25)', borderRadius: 10, padding: '2px 8px', fontWeight: 700, letterSpacing: 1 }}>
                        NOW
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: T.textFaint, marginTop: 2 }}>
                    {m.minutes === 0 ? 'Starting allocation' : `${fmt(m.minutes)} focus minutes`}
                  </div>
                  {active && next && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ height: 2, background: T.border, borderRadius: 1, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, ((totalMinutes - m.minutes) / (next.minutes - m.minutes)) * 100)}%` }}
                          transition={{ duration: 1 }}
                          style={{ height: '100%', background: '#00b4d8', borderRadius: 1 }}
                        />
                      </div>
                      <div style={{ fontSize: 8, color: T.textFaint, marginTop: 2 }}>
                        {fmt(next.minutes - totalMinutes)} min to {next.slots} bays
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Parts header counter ─────────────────────────────────────────────────────
function PartsHeader({ available, total, ownedCount, capacity, loading }) {
  const T = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 10px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flex: 1,
        background: 'rgba(0,180,216,0.07)', border: '1px solid rgba(0,180,216,0.12)',
        borderRadius: 12, padding: '7px 12px',
      }}>
        <Zap size={12} style={{ color: '#00b4d8', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: T.textFaint, letterSpacing: 1, lineHeight: 1 }}>AVAILABLE PARTS</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color: '#00b4d8', fontSize: 16, lineHeight: 1.1 }}>
            {loading ? '—' : <AnimNum value={available} />}
          </div>
        </div>
        {!loading && (
          <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: T.textFaint, letterSpacing: 1 }}>SPENT</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.textFaint }}>{fmt(total - available)}</div>
          </div>
        )}
      </div>

      {/* Hangar fill gauge */}
      {!loading && (
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 44, height: 44 }}>
            <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="22" cy="22" r="17" fill="none" stroke={T.border} strokeWidth="3" />
              <motion.circle cx="22" cy="22" r="17" fill="none" stroke="#E8A030" strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 17}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 17 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 17 * (1 - ownedCount / Math.max(capacity, 1)) }}
                transition={{ duration: 0.8 }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 800, color: '#E8A030', lineHeight: 1 }}>{ownedCount}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: T.textFaint, lineHeight: 1 }}>/{capacity}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export function HangarScreen() {
  const { state, dispatch } = useApp();
  const { isGuest } = useAuth();
  const isDark = state.theme !== 'light';

  const T = isDark ? {
    isDark: true,
    bg:       '#07111f',
    bg2:      '#0a1628',
    surface:  '#0C1627',
    surface2: '#0d1929',
    vignette: '#07111f',
    header:   'rgba(5,8,18,0.97)',
    bottomNav:'rgba(3,5,12,0.97)',
    border:   '#1a2740',
    border2:  '#0d1929',
    text:     '#c0d0e0',
    textMuted:'#4a5568',
    textFaint:'#2a3a50',
  } : {
    isDark: false,
    bg:       '#f0f6ff',
    bg2:      '#f8faff',
    surface:  '#ffffff',
    surface2: '#f1f5f9',
    vignette: '#f0f6ff',
    header:   'rgba(240,246,255,0.97)',
    bottomNav:'rgba(240,246,255,0.97)',
    border:   '#e2e8f0',
    border2:  '#f0f4f8',
    text:     '#1e293b',
    textMuted:'#64748b',
    textFaint:'#94a3b8',
  };

  const [tab, setTab] = useState('hangars');
  const [hangar, setHangar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDef, setSelectedDef] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [buyingSlot, setBuyingSlot] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const buyingRef = useRef(false);
  const claimingRef = useRef(false);

  const refresh = useCallback(() =>
    api.getHangar().then(setHangar).catch(console.error), []);

  useEffect(() => { refresh().finally(() => setLoading(false)); }, [refresh]);

  if (isGuest) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.text, textAlign: 'center' }}>Hangar locked</div>
        <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', maxWidth: 260 }}>Create a free account to collect aircraft and build your fleet.</div>
        <button onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'home' })}
          style={{ marginTop: 8, padding: '13px 32px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #00b4d8, #0096c7)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    );
  }

  const owned = hangar?.owned ?? [];
  const ownedCodes = owned.map(a => a.aircraft_code);
  const available = hangar?.available_parts ?? 0;
  const total = hangar?.total_parts ?? 0;
  const capacity = hangar?.capacity ?? 3;
  const nextSlotCost = hangar?.next_slot_cost ?? 200;
  const ownedCount = owned.length;

  const handleClaim = async () => {
    if (!selectedDef || claimingRef.current) return;
    claimingRef.current = true;
    setClaiming(true); setClaimError('');
    try {
      await api.claimAircraft(selectedDef.code);
      await refresh();
      setSelectedDef(null);
    } catch (err) {
      setClaimError(err.data?.error || err.message || 'Purchase failed');
    } finally {
      claimingRef.current = false;
      setClaiming(false);
    }
  };

  const handleBuySlot = async () => {
    if (buyingRef.current) return;
    buyingRef.current = true;
    setBuyingSlot(true); setSlotError('');
    try {
      await api.buySlot();
      await refresh();
    } catch (err) {
      setSlotError(err.data?.error || err.message || 'Could not expand hangar');
    } finally {
      buyingRef.current = false;
      setBuyingSlot(false);
    }
  };

  const catalogFiltered = catFilter === 'all'
    ? AIRCRAFT_CATALOG
    : AIRCRAFT_CATALOG.filter(d => d.category === catFilter);

  const TABS = [
    { id: 'hangars', label: 'HANGARS' },
    { id: 'aircraft', label: 'AIRCRAFT' },
    { id: 'expand', label: 'EXPAND' },
  ];

  return (
    <TC.Provider value={T}>
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

        {/* Background breathing orb */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', pointerEvents: 'none', zIndex: 0,
            width: 600, height: 600, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,160,48,0.07) 0%, transparent 70%)',
            top: '-20%', left: '50%', transform: 'translateX(-50%)',
          }}
        />

        {/* ── Sticky header ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: isDark ? 'rgba(7,8,14,0.95)' : T.header,
          backdropFilter: 'blur(20px)',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : `1px solid ${T.border2}`,
          paddingTop: 'max(10px, env(safe-area-inset-top, 10px))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 10px' }}>
            <button onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'home' })}
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: isDark ? '1px solid rgba(255,255,255,0.1)' : `1px solid ${T.border}`,
                cursor: 'pointer', color: '#475569', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : T.border; }}
            >
              <ArrowLeft size={16} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: '#E8A030', letterSpacing: 3 }}>
                FLODORO AIR
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: T.textFaint, letterSpacing: 2 }}>
                FLEET OPERATIONS CENTER
              </div>
            </div>
          </div>

          <PartsHeader
            available={available}
            total={total}
            ownedCount={ownedCount}
            capacity={capacity}
            loading={loading}
          />

          {/* Tab nav */}
          <div style={{ display: 'flex', borderTop: `1px solid ${T.border2}` }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, padding: '9px 4px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${tab === t.id ? '#E8A030' : 'transparent'}`,
                color: tab === t.id ? '#E8A030' : T.textFaint,
                fontSize: 9, fontWeight: 700, letterSpacing: 2,
                fontFamily: "'JetBrains Mono',monospace", transition: 'all 0.15s',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}>
              <Plane size={24} style={{ color: '#E8A030' }} />
            </motion.div>
          </div>
        ) : (
          <div style={{ flex: 1, padding: '14px 14px', paddingBottom: 'max(90px, env(safe-area-inset-bottom, 90px))', position: 'relative', zIndex: 1 }}>

            {/* ── HANGARS TAB ── */}
            {tab === 'hangars' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {owned.map((ua, i) => (
                  <BayStrip key={ua.id} index={i} aircraft={ua} onView={setSelectedDef} />
                ))}

                {Array.from({ length: capacity - ownedCount }).map((_, i) => (
                  <VacantBay key={`v${i}`} index={ownedCount + i} />
                ))}

                <BuySlotStrip
                  index={capacity}
                  cost={nextSlotCost}
                  availableParts={available}
                  onBuy={handleBuySlot}
                  buying={buyingSlot}
                />

                {slotError && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 11, color: '#ef4444', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <AlertCircle size={12} />{slotError}
                  </div>
                )}

                {ownedCount === 0 && capacity > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    style={{ textAlign: 'center', padding: '24px 16px' }}
                  >
                    <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 6 }}>Your hangar is empty</div>
                    <div style={{ fontSize: 11, color: T.textFaint }}>Complete focus sessions to earn ⚙ parts, then acquire aircraft from the AIRCRAFT tab.</div>
                    <motion.button
                      onClick={() => setTab('aircraft')}
                      style={{ marginTop: 14, padding: '10px 24px', borderRadius: 12, border: 'none', background: T.border, color: '#00b4d8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      whileTap={{ scale: 0.96 }}
                    >
                      Browse Aircraft →
                    </motion.button>
                  </motion.div>
                )}
              </div>
            )}

            {/* ── AIRCRAFT TAB ── */}
            {tab === 'aircraft' && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <CategoryPills active={catFilter} onChange={setCatFilter} />
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: T.textFaint, letterSpacing: 2, marginBottom: 10 }}>
                  {catalogFiltered.length} TYPES · {ownedCodes.filter(c => catalogFiltered.some(d => d.code === c)).length} OWNED
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {catalogFiltered.map((def, i) => (
                    <CatalogCard
                      key={def.code}
                      def={def}
                      index={i}
                      isOwned={ownedCodes.includes(def.code)}
                      availableParts={available}
                      onSelect={setSelectedDef}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── EXPAND TAB ── */}
            {tab === 'expand' && (
              <ExpandTab
                hangar={hangar}
                onBuySlot={handleBuySlot}
                buying={buyingSlot}
                slotError={slotError}
              />
            )}
          </div>
        )}

        {/* ── Bottom nav ── */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
          background: isDark ? 'rgba(7,8,14,0.95)' : T.bottomNav,
          backdropFilter: 'blur(20px)',
          borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : `1px solid ${T.border2}`,
          display: 'flex', paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
        }}>
          {[
            { icon: <Home size={16} />, label: 'Home', screen: 'home' },
            { icon: <Plane size={16} />, label: 'Hangar', screen: 'hangar', active: true },
            { icon: <Users size={16} />, label: 'Live', screen: 'live-sessions' },
            { icon: <BarChart2 size={16} />, label: 'Stats', screen: 'stats' },
          ].map(item => (
            <button key={item.screen} onClick={() => dispatch({ type: 'SET_SCREEN', payload: item.screen })}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 3, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer',
                color: item.active ? '#E8A030' : '#475569', fontSize: 9, fontWeight: 700,
                letterSpacing: 0.5, transition: 'color 0.15s',
              }}
              onMouseEnter={e => { if (!item.active) e.currentTarget.style.color = '#94a3b8'; }}
              onMouseLeave={e => { if (!item.active) e.currentTarget.style.color = '#475569'; }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* ── Modal ── */}
        <AnimatePresence>
          {selectedDef && (
            <AircraftModal
              def={selectedDef}
              isOwned={ownedCodes.includes(selectedDef.code)}
              availableParts={available}
              onClaim={handleClaim}
              onClose={() => { setSelectedDef(null); setClaimError(''); }}
              claiming={claiming}
              error={claimError}
            />
          )}
        </AnimatePresence>
      </div>
    </TC.Provider>
  );
}
