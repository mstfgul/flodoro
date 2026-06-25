import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { formatTime } from '../../utils/format';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function FlightTimer({ elapsed, remaining, totalSeconds, progress, status, isRealistic, theme = 'dark' }) {
  const dashOffset = useMemo(() => CIRCUMFERENCE * (1 - progress), [progress]);

  const progressColor = useMemo(() => {
    if (isRealistic) return '#00b4d8';
    if (progress < 0.5) return '#00b4d8';
    if (progress < 0.8) return '#48cae4';
    return '#f4a261';
  }, [progress, isRealistic]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={RADIUS} fill="none" stroke={theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'} strokeWidth="6" />
          <motion.circle
            cx="64" cy="64" r={RADIUS}
            fill="none"
            stroke={progressColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ filter: `drop-shadow(0 0 6px ${progressColor}80)` }}
            transition={{ duration: 1, ease: 'linear' }}
          />
          {/* Realistic: animated spinner pulse at end */}
          {isRealistic && (
            <circle
              cx="64" cy="64" r={RADIUS}
              fill="none"
              stroke={progressColor}
              strokeWidth="2"
              strokeOpacity="0.2"
              strokeDasharray="4 8"
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`timer-display text-2xl font-semibold tabular-nums ${theme === 'light' ? 'text-[#0f172a]' : 'text-white'}`}>
            {formatTime(isRealistic ? elapsed : (remaining ?? 0))}
          </span>
          <span className="text-xs text-[#64748b] mt-0.5">
            {status === 'paused'
              ? 'paused'
              : isRealistic
              ? 'elapsed'
              : 'remaining'}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full mt-4">
        {isRealistic ? (
          <div className="text-center">
            <span className="text-xs text-[#475569]">
              Real-time mode — awaiting landing
            </span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-xs text-[#64748b] mb-1.5">
              <span>{Math.round(progress * 100)}% complete</span>
              <span>{formatTime(totalSeconds)} total</span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden ${theme === 'light' ? 'bg-black/8' : 'bg-white/5'}`}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, #00b4d8, ${progressColor})` }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
