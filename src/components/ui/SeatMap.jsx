import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLS = ['A', 'B', 'C', '', 'D', 'E', 'F']; // '' = aisle
const ROWS = 7; // 7 rows × 6 seats = 42 seats

const SEAT_COLORS = {
  completed: { bg: '#22c55e', border: '#16a34a', glow: 'rgba(34,197,94,0.4)' },
  active:    { bg: '#00b4d8', border: '#0096b7', glow: 'rgba(0,180,216,0.5)' },
  empty:     { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', glow: 'none' },
  missed:    { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)', glow: 'none' },
};

export function SeatMap({ sessions = [] }) {
  // Map sessions to seat slots — one per session, max 42 total displayed
  const seats = useMemo(() => {
    const today = new Date();
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - 6 + i);
      return d.toISOString().slice(0, 10);
    });

    // Group sessions by date
    const byDate = {};
    sessions.forEach(s => {
      const date = s.created_at ? s.created_at.slice(0, 10) : null;
      if (!date || !week.includes(date)) return;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(s);
    });

    // Flatten: for each day up to 6 sessions (one column in the seat map)
    const flat = [];
    week.forEach(date => {
      const daySessions = (byDate[date] || []).slice(0, 6);
      for (let i = 0; i < 6; i++) {
        const s = daySessions[i];
        flat.push(s
          ? { status: s.status === 'completed' ? 'completed' : 'missed', date }
          : { status: 'empty', date }
        );
      }
    });

    return flat; // 7 days × 6 seats = 42
  }, [sessions]);

  const completedCount = seats.filter(s => s.status === 'completed').length;

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['completed','Completed'],['missed','Missed'],['empty','Empty']].map(([st, label]) => (
          <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 10, height: 10, borderRadius: 3,
              background: SEAT_COLORS[st].bg,
              border: `1px solid ${SEAT_COLORS[st].border}`,
            }} />
            <span style={{ fontSize: 11, color: '#475569' }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
          {completedCount} / {seats.filter(s => s.status !== 'empty').length} flights
        </div>
      </div>

      {/* Airplane silhouette */}
      <div style={{ position: 'relative' }}>
        {/* Fuselage outline */}
        <svg viewBox="0 0 320 200" style={{ width: '100%', opacity: 0.08, pointerEvents: 'none', position: 'absolute', top: -10 }}>
          <path d="M160 5 C 90 5, 20 50, 10 100 C 20 150, 90 185, 160 185 C 230 185, 300 150, 310 100 C 300 50, 230 5, 160 5 Z"
            fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
          {/* Wings */}
          <path d="M 60 100 L -60 130 L -40 140 L 80 110 Z" fill="rgba(255,255,255,0.5)" />
          <path d="M 260 100 L 380 130 L 360 140 L 240 110 Z" fill="rgba(255,255,255,0.5)" />
        </svg>

        {/* Day labels (top) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.05em' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Seat grid: 6 rows (sessions) × 7 columns (days) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {Array.from({ length: 6 }, (_, row) => (
            <div key={row} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {Array.from({ length: 7 }, (_, col) => {
                const seat = seats[col * 6 + row];
                if (!seat) return <div key={col} />;
                const sc = SEAT_COLORS[seat.status];
                return (
                  <motion.div
                    key={col}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (col * 6 + row) * 0.008 }}
                    title={seat.status === 'completed' ? `${seat.date} · Completed` : seat.status === 'missed' ? 'Missed' : 'Empty'}
                    style={{
                      height: 22, borderRadius: 5,
                      background: sc.bg,
                      border: `1px solid ${sc.border}`,
                      boxShadow: sc.glow !== 'none' ? `0 0 6px ${sc.glow}` : 'none',
                      transition: 'transform 0.1s',
                      cursor: seat.status !== 'empty' ? 'pointer' : 'default',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Row labels */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
          <span style={{ fontSize: 10, color: '#334155' }}>Last 7 days · Each row = 1 session</span>
        </div>
      </div>
    </div>
  );
}
