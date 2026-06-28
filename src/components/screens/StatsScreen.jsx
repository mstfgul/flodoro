import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Navigation, Flame, TrendingUp, Plane, Map } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { loadSessions } from '../../services/sessions';
import { formatDuration } from '../../utils/format';
import { HistoryMap } from '../map/HistoryMap';
import { SeatMap } from '../ui/SeatMap';

function BarChart({ data }) {
  const [selected, setSelected] = useState(null);
  if (!data || data.length === 0) return null;
  const maxMin = Math.max(...data.map((d) => d.minutes), 1);
  const recent = data.slice(-14);
  const today = new Date().toISOString().slice(0, 10);
  const sel = selected !== null ? recent[selected] : null;

  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-28">
        {recent.map((d, i) => {
          const pct = d.minutes / maxMin;
          const isToday = d.date === today;
          const isSel = selected === i;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-1 relative cursor-pointer"
              onClick={() => setSelected(isSel ? null : i)}
            >
              <div className="w-full relative flex items-end" style={{ height: 88 }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(pct * 88, d.minutes > 0 ? 4 : 1)}px` }}
                  transition={{ delay: i * 0.03, duration: 0.5, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', bottom: 0,
                    width: '100%', borderRadius: '2px 2px 0 0',
                    background: isSel ? '#fff' : isToday ? '#f4a261' : d.minutes > 0 ? '#00b4d8' : 'rgba(255,255,255,0.05)',
                    opacity: d.minutes > 0 ? 1 : 0.3,
                    transition: 'background 0.15s',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Date labels */}
      <div className="flex gap-1 mt-1">
        {recent.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % 3 === 0 && <span className="text-[9px] text-[#374151]">{d.date.slice(8)}</span>}
          </div>
        ))}
      </div>

      {/* Tap info — works on both mobile and desktop */}
      <div style={{ minHeight: 48, marginTop: 10 }}>
        {sel ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div>
              <div className="text-xs font-semibold text-white">{sel.date}</div>
              <div className="text-[10px] text-[#64748b] mt-0.5">{sel.sessions} flight{sel.sessions !== 1 ? 's' : ''}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-[#00b4d8]">{sel.minutes} min</div>
              <div className="text-[10px] text-[#64748b]">{Math.floor(sel.minutes / 60)}h {sel.minutes % 60}m</div>
            </div>
          </motion.div>
        ) : (
          <div className="text-[10px] text-[#2A3450] text-center pt-3">
            Tap a bar for details
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = '#00b4d8', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass border border-white/8 rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-xs text-[#64748b]">{label}</span>
      </div>
      <div className="text-xl font-bold text-white leading-tight">{value}</div>
      {sub && <div className="text-xs text-[#475569] mt-0.5">{sub}</div>}
    </motion.div>
  );
}

function computeStats(sessions) {
  const completed = sessions.filter(s => s.status === 'completed');
  const total_minutes = completed.reduce((sum, s) => sum + (s.duration_min || 0), 0);
  const total_km = completed.reduce((sum, s) => sum + (s.distance_km || 0), 0);

  // Daily history: last 30 days
  const byDate = {};
  completed.forEach(s => {
    const date = s.created_at?.slice(0, 10) || '';
    if (!date) return;
    if (!byDate[date]) byDate[date] = { date, minutes: 0, sessions: 0 };
    byDate[date].minutes += s.duration_min || 0;
    byDate[date].sessions += 1;
  });

  // Fill last 30 days
  const history = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    history.push(byDate[date] || { date, minutes: 0, sessions: 0 });
  }

  // Streak
  let current_streak = 0;
  let longest_streak = 0;
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].minutes > 0) {
      streak += 1;
      if (i === history.length - 1 || history[i + 1].date === today) current_streak = streak;
      longest_streak = Math.max(longest_streak, streak);
    } else {
      if (current_streak === 0) streak = 0; // still counting backwards for longest
      else break;
    }
  }
  // recalculate longest properly
  longest_streak = 0;
  streak = 0;
  history.forEach(d => {
    if (d.minutes > 0) { streak++; longest_streak = Math.max(longest_streak, streak); }
    else streak = 0;
  });

  return { total_minutes, total_sessions: completed.length, total_km, total_miles: total_km * 0.621371, current_streak, longest_streak, history };
}

export function StatsScreen() {
  const { dispatch } = useApp();
  const { isAuthenticated, isGuest } = useAuth();

  // Backend stats (for authenticated users)
  const [backendStats, setBackendStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [backendSessions, setBackendSessions] = useState([]);

  // localStorage stats (for guests)
  const [localSessions, setLocalSessions] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      Promise.all([
        api.getStats(),
        api.getHistory(),
        api.listSessions(),
      ])
        .then(([s, h, sess]) => {
          setBackendStats(s);
          setHistory(h || []);
          setBackendSessions(sess || []);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLocalSessions(loadSessions());
      setLoading(false);
    }
  }, [isAuthenticated]);

  const localStats = useMemo(() => computeStats(localSessions), [localSessions]);

  const stats = isAuthenticated ? {
    total_minutes:  backendStats?.total_minutes  ?? 0,
    total_sessions: backendStats?.total_sessions ?? 0,
    total_km:       backendStats?.total_km       ?? 0,
    total_miles:    backendStats?.total_miles     ?? 0,
    current_streak: backendStats?.current_streak ?? 0,
    longest_streak: backendStats?.longest_streak ?? 0,
    history: history.map(d => ({ date: d.date, minutes: d.minutes, sessions: d.sessions })),
  } : localStats;

  const sessions = isAuthenticated ? backendSessions : localSessions;
  const totalHours = Math.floor(stats.total_minutes / 60);
  const totalMins = stats.total_minutes % 60;
  const isEmpty = stats.total_sessions === 0;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}>

      {/* Background breathing orb */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute pointer-events-none"
        style={{
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,180,216,0.07) 0%, transparent 70%)',
          top: '-20%', left: '50%', transform: 'translateX(-50%)', zIndex: 0,
        }}
      />

      <div className="flex items-center gap-3 px-4 sm:px-5 border-b relative z-10"
        style={{
          background: 'rgba(7,8,14,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 50,
          paddingTop: 'max(12px, env(safe-area-inset-top, 12px))', paddingBottom: 12,
        }}>
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'home' })}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer', color: '#475569', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Statistics</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#475569', letterSpacing: '0.08em', marginTop: 2 }}>
            {isAuthenticated ? (backendStats?.display_name || '').toUpperCase() || 'YOUR STATS' : 'GUEST · LOCAL ONLY'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{ color: '#00b4d8', fontSize: 24 }}
          >✈</motion.div>
        </div>
      ) : (
        <div className="flex-1 max-w-2xl mx-auto w-full px-5 py-6 space-y-6 relative z-10">
          {isEmpty ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="text-4xl mb-4">✈️</div>
              <h2 className="text-lg font-semibold text-white mb-2">No flights yet</h2>
              <p className="text-sm text-[#64748b] max-w-xs">
                Complete your first flight — your stats will appear here.
              </p>
            </motion.div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Clock}
                  label="Total Focus"
                  value={`${totalHours}h ${totalMins}m`}
                  sub={`${stats.total_sessions} flights`}
                  color="#00b4d8"
                  delay={0}
                />
                <StatCard
                  icon={Navigation}
                  label="Distance Flown"
                  value={`${Math.round(stats.total_km).toLocaleString()} km`}
                  sub={`${Math.round(stats.total_miles).toLocaleString()} mi`}
                  color="#48cae4"
                  delay={0.05}
                />
                <StatCard
                  icon={Flame}
                  label="Current Streak"
                  value={`${stats.current_streak} days`}
                  sub={stats.current_streak > 0 ? '🔥 Ongoing' : 'Start today!'}
                  color="#f4a261"
                  delay={0.1}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Longest Streak"
                  value={`${stats.longest_streak} days`}
                  sub="All-time record"
                  color="#48cae4"
                  delay={0.15}
                />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass border border-white/8 rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Last 30 Days</h3>
                    <p className="text-xs text-[#64748b]">Daily focus minutes</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#64748b]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#00b4d8] inline-block" />Day</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#f4a261] inline-block" />Today</span>
                  </div>
                </div>
                {stats.history.some(d => d.minutes > 0) ? (
                  <BarChart data={stats.history} />
                ) : (
                  <div className="h-28 flex items-center justify-center text-[#374151] text-sm">
                    No data yet — make your first flight!
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="glass border border-white/8 rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Map size={14} className="text-[#00b4d8]" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Flight Map</h3>
                    <p className="text-xs text-[#64748b]">All routes</p>
                  </div>
                  <div className="ml-auto flex items-center gap-3 text-xs text-[#64748b]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00b4d8] inline-block" />Live</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f4a261] inline-block" />City</span>
                  </div>
                </div>
                <HistoryMap sessions={sessions} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.33 }}
                className="glass border border-white/8 rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm">💺</span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Weekly Seat Map</h3>
                    <p className="text-xs text-[#64748b]">Each seat = one focus session</p>
                  </div>
                </div>
                <SeatMap sessions={sessions} />
              </motion.div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
