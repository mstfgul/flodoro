import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, Navigation, Flame, TrendingUp, Plane, Map } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { loadSessions } from '../../services/sessions';
import { formatDuration } from '../../utils/format';
import { HistoryMap } from '../map/HistoryMap';
import { SeatMap } from '../ui/SeatMap';

function BarChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxMin = Math.max(...data.map((d) => d.minutes), 1);
  const recent = data.slice(-14);

  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-28">
        {recent.map((d, i) => {
          const pct = d.minutes / maxMin;
          const isToday = d.date === new Date().toISOString().slice(0, 10);
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full relative flex items-end" style={{ height: 88 }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(pct * 88, d.minutes > 0 ? 4 : 1)}px` }}
                  transition={{ delay: i * 0.03, duration: 0.5, ease: 'easeOut' }}
                  className={`w-full rounded-t-sm ${
                    isToday ? 'bg-[#f4a261]' : d.minutes > 0 ? 'bg-[#00b4d8]' : 'bg-white/5'
                  }`}
                  style={{ position: 'absolute', bottom: 0, opacity: d.minutes > 0 ? 1 : 0.3 }}
                />
              </div>
              {d.minutes > 0 && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap">
                  <div className="glass border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                    <div className="font-medium">{d.date.slice(5)}</div>
                    <div className="text-[#00b4d8]">{d.minutes} dk</div>
                    <div className="text-[#64748b]">{d.sessions} uçuş</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {recent.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % 3 === 0 && <span className="text-[9px] text-[#374151]">{d.date.slice(8)}</span>}
          </div>
        ))}
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
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  const stats = useMemo(() => computeStats(sessions), [sessions]);
  const totalHours = Math.floor(stats.total_minutes / 60);
  const totalMins = stats.total_minutes % 60;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center gap-4 px-5 py-4 glass border-b border-white/5">
        <button
          onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'home' })}
          className="p-2 hover:bg-white/5 rounded-lg text-[#64748b] hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-semibold text-white">İstatistikler</h1>
          <p className="text-xs text-[#64748b]">Tüm zamanlar</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-5 py-6 space-y-6">
        {sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="text-4xl mb-4">✈️</div>
            <h2 className="text-lg font-semibold text-white mb-2">Henüz uçuş yok</h2>
            <p className="text-sm text-[#64748b] max-w-xs">
              İlk uçuşunu tamamla — istatistiklerin burada görünecek.
            </p>
          </motion.div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={Clock}
                label="Toplam Çalışma"
                value={`${totalHours}s ${totalMins}dk`}
                sub={`${stats.total_sessions} uçuş`}
                color="#00b4d8"
                delay={0}
              />
              <StatCard
                icon={Navigation}
                label="Uçulan Mesafe"
                value={`${Math.round(stats.total_km).toLocaleString()} km`}
                sub={`${Math.round(stats.total_miles).toLocaleString()} mil`}
                color="#48cae4"
                delay={0.05}
              />
              <StatCard
                icon={Flame}
                label="Güncel Seri"
                value={`${stats.current_streak} gün`}
                sub={stats.current_streak > 0 ? '🔥 Devam ediyor' : 'Bugün başla!'}
                color="#f4a261"
                delay={0.1}
              />
              <StatCard
                icon={TrendingUp}
                label="En Uzun Seri"
                value={`${stats.longest_streak} gün`}
                sub="Tüm zamanlar rekoru"
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
                  <h3 className="text-sm font-semibold text-white">Son 30 Gün</h3>
                  <p className="text-xs text-[#64748b]">Günlük çalışma dakikaları</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#64748b]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#00b4d8] inline-block" />Gün</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#f4a261] inline-block" />Bugün</span>
                </div>
              </div>
              {stats.history.some(d => d.minutes > 0) ? (
                <BarChart data={stats.history} />
              ) : (
                <div className="h-28 flex items-center justify-center text-[#374151] text-sm">
                  Henüz veri yok — ilk uçuşunu yap!
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
                  <h3 className="text-sm font-semibold text-white">Uçuş Haritası</h3>
                  <p className="text-xs text-[#64748b]">Tüm rotalar</p>
                </div>
                <div className="ml-auto flex items-center gap-3 text-xs text-[#64748b]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00b4d8] inline-block" />Canlı</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f4a261] inline-block" />Şehir</span>
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
                  <h3 className="text-sm font-semibold text-white">Haftalık Koltuk Haritası</h3>
                  <p className="text-xs text-[#64748b]">Her koltuk = bir fokus seansı</p>
                </div>
              </div>
              <SeatMap sessions={sessions} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="flex items-center gap-3 p-4 glass border border-white/8 rounded-xl"
            >
              <Plane size={16} className="text-[#00b4d8] flex-shrink-0" />
              <p className="text-xs text-[#64748b]">
                Her tamamlanan uçuş otomatik olarak bu cihazda saklanır.
              </p>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
