import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, ChevronRight, Zap, Clock, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { SeatPickerModal } from '../ui/SeatPickerModal';
import { shortFlights, classicPairs, airports } from '../../data/cityPairs';
import { haversineDistance, estimateDuration } from '../../utils/geo';
import { formatDuration } from '../../utils/format';

const SUB_MODES = [
  { id: 'short', label: 'Kısa Uçuşlar', sub: '20-35 dk gerçek rotalar', icon: Zap, color: '#00b4d8' },
  { id: 'classic', label: 'Klasik Pomodoro', sub: 'Tam 25 dakika, tematik', icon: Clock, color: '#f4a261' },
  { id: 'custom', label: 'Özel Rota', sub: 'Kendi şehirlerini seç', icon: Globe, color: '#48cae4' },
];

function PairCard({ pair, onClick, accent = '#00b4d8' }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, x: 3 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(pair)}
      className="flight-card w-full glass border border-white/8 rounded-xl p-4 text-left"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{pair.from.city}</span>
            <span className="text-[#475569]">→</span>
            <span className="text-sm font-semibold text-white">{pair.to.city}</span>
            {pair.emoji && <span className="text-sm">{pair.emoji}</span>}
          </div>
          <div className="flex items-center gap-2 text-xs text-[#64748b]">
            <span>{pair.from.code}</span>
            <span>·</span>
            <span>{pair.to.code}</span>
            <span>·</span>
            <span>{pair.description}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-sm font-bold" style={{ color: accent }}>
            {formatDuration(pair.duration)}
          </span>
          <ChevronRight size={14} className="text-[#475569]" />
        </div>
      </div>
    </motion.button>
  );
}

function AirportSearch({ placeholder, value, onChange, onSelect, exclude }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return airports
      .filter((a) => a.code !== exclude?.code)
      .filter(
        (a) =>
          a.city.toLowerCase().includes(q) ||
          a.code.toLowerCase().includes(q) ||
          a.country.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [query, exclude]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-[#00b4d8]/40">
        <Search size={14} className="text-[#64748b] flex-shrink-0" />
        <input
          type="text"
          placeholder={placeholder}
          value={value ? `${value.city} (${value.code})` : query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange(null);
          }}
          onFocus={() => { if (value) setQuery(''); }}
          className="flex-1 bg-transparent text-sm text-white placeholder-[#475569] focus:outline-none"
        />
        {value && (
          <button
            onClick={() => { onChange(null); setQuery(''); }}
            className="text-[#64748b] hover:text-white text-xs"
          >
            ×
          </button>
        )}
      </div>
      <AnimatePresence>
        {filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 glass border border-white/10 rounded-xl overflow-hidden z-20"
          >
            {filtered.map((a) => (
              <button
                key={a.code}
                onClick={() => { onSelect(a); setQuery(''); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left transition-colors"
              >
                <span className="text-xs font-bold text-[#00b4d8] w-10">{a.code}</span>
                <div>
                  <div className="text-sm text-white">{a.city}</div>
                  <div className="text-xs text-[#64748b]">{a.country}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CityModeScreen() {
  const { dispatch } = useApp();
  const [subMode, setSubMode] = useState(null);
  const [fromAirport, setFromAirport] = useState(null);
  const [toAirport, setToAirport] = useState(null);
  const [showSeatPicker, setShowSeatPicker] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  const customDuration = useMemo(() => {
    if (!fromAirport || !toAirport) return null;
    const dist = haversineDistance(fromAirport.lat, fromAirport.lon, toAirport.lat, toAirport.lon);
    return estimateDuration(dist);
  }, [fromAirport, toAirport]);

  const openSeatPicker = (payload) => {
    setPendingPayload(payload);
    setShowSeatPicker(true);
  };

  const handleSeatConfirm = (seat) => {
    setShowSeatPicker(false);
    if (pendingPayload) dispatch({ type: 'START_SESSION', payload: { ...pendingPayload, seat } });
    setPendingPayload(null);
  };

  const selectPair = (pair) => {
    openSeatPicker({
      mode: 'city', subMode,
      origin: pair.from, destination: pair.to, duration: pair.duration,
    });
  };

  const startCustom = () => {
    if (!fromAirport || !toAirport || !customDuration) return;
    openSeatPicker({
      mode: 'city', subMode: 'custom',
      origin: fromAirport, destination: toAirport, duration: customDuration,
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatePresence>
        {showSeatPicker && (
          <SeatPickerModal onConfirm={handleSeatConfirm} onClose={() => setShowSeatPicker(false)} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 glass border-b border-white/5">
        <button
          onClick={() => {
            if (subMode) setSubMode(null);
            else dispatch({ type: 'SET_SCREEN', payload: 'home' });
          }}
          className="p-2 hover:bg-white/5 rounded-lg text-[#64748b] hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-semibold text-white">Şehir Seç</h1>
          <p className="text-xs text-[#64748b]">
            {subMode
              ? SUB_MODES.find((s) => s.id === subMode)?.label
              : 'Mod seçin'}
          </p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-5 py-6">
        <AnimatePresence mode="wait">
          {!subMode ? (
            /* Sub-mode selection */
            <motion.div
              key="submodes"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-3"
            >
              {SUB_MODES.map((m, i) => (
                <motion.button
                  key={m.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.08 } }}
                  whileHover={{ scale: 1.02, x: 6 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSubMode(m.id)}
                  className="flight-card w-full glass border border-white/8 rounded-2xl p-5 text-left"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${m.color}15` }}
                    >
                      <m.icon size={20} style={{ color: m.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white mb-0.5">{m.label}</div>
                      <div className="text-sm text-[#64748b]">{m.sub}</div>
                    </div>
                    <ChevronRight size={16} className="text-[#475569]" />
                  </div>
                </motion.button>
              ))}
            </motion.div>
          ) : subMode === 'short' ? (
            /* Short flights */
            <motion.div
              key="short"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-2"
            >
              <p className="text-xs text-[#64748b] mb-4">
                Gerçek kısa uçuş rotaları — 20-35 dakika
              </p>
              {shortFlights.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                >
                  <PairCard pair={p} onClick={selectPair} accent="#00b4d8" />
                </motion.div>
              ))}
            </motion.div>
          ) : subMode === 'classic' ? (
            /* Classic Pomodoro */
            <motion.div
              key="classic"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 mb-4 p-3 bg-[#f4a261]/10 border border-[#f4a261]/20 rounded-xl">
                <Clock size={14} className="text-[#f4a261] flex-shrink-0" />
                <p className="text-xs text-[#f4a261]">
                  Bu modda sayaç tam 25 dakikadır. Şehirler atmosfer içindir.
                </p>
              </div>
              {classicPairs.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                >
                  <PairCard pair={p} onClick={selectPair} accent="#f4a261" />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            /* Custom */
            <motion.div
              key="custom"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <p className="text-xs text-[#64748b]">
                40+ havalimanından seç, süre otomatik hesaplanır
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#94a3b8] mb-1.5 block">Kalkış ✈</label>
                  <AirportSearch
                    placeholder="Şehir veya kod ara… (İstanbul, IST…)"
                    value={fromAirport}
                    onChange={setFromAirport}
                    onSelect={setFromAirport}
                    exclude={toAirport}
                  />
                </div>

                <div>
                  <label className="text-xs text-[#94a3b8] mb-1.5 block">Varış 🛬</label>
                  <AirportSearch
                    placeholder="Şehir veya kod ara…"
                    value={toAirport}
                    onChange={setToAirport}
                    onSelect={setToAirport}
                    exclude={fromAirport}
                  />
                </div>
              </div>

              {fromAirport && toAirport && customDuration && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass border border-[#00b4d8]/25 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {fromAirport.city} → {toAirport.city}
                      </div>
                      <div className="text-xs text-[#64748b]">
                        {fromAirport.code} → {toAirport.code}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#00b4d8]">
                        {formatDuration(customDuration)}
                      </div>
                      <div className="text-xs text-[#64748b]">tahmini süre</div>
                    </div>
                  </div>
                  <Button onClick={startCustom} variant="primary" size="lg" className="w-full">
                    Uçuşa Başla ✈
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
