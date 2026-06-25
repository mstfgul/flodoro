import { useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';

export function useTimer(onComplete) {
  const { state, dispatch } = useApp();
  const { session } = state;
  const intervalRef = useRef(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const isRealistic = session?.isRealistic ?? false;
  const totalSeconds = session ? session.duration * 60 : 0;
  const elapsed = session ? session.elapsed : 0;
  const status = session ? session.status : 'idle';

  useEffect(() => {
    if (status !== 'running') {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [status, dispatch]);

  // Countdown completion (only for non-realistic)
  useEffect(() => {
    if (isRealistic) return;
    if (elapsed >= totalSeconds && totalSeconds > 0 && status === 'running') {
      clearInterval(intervalRef.current);
      dispatch({ type: 'SET_SESSION_STATUS', payload: 'completed' });
      onCompleteRef.current?.();
    }
  }, [elapsed, totalSeconds, status, isRealistic, dispatch]);

  const pause = useCallback(() => dispatch({ type: 'SET_SESSION_STATUS', payload: 'paused' }), [dispatch]);
  const resume = useCallback(() => dispatch({ type: 'SET_SESSION_STATUS', payload: 'running' }), [dispatch]);

  const remaining = isRealistic ? null : Math.max(0, totalSeconds - elapsed);
  const progress = isRealistic
    ? (elapsed % 3600) / 3600 // slow full-circle per hour for realistic
    : totalSeconds > 0 ? Math.min(elapsed / totalSeconds, 1) : 0;

  return { elapsed, remaining, progress, status, pause, resume, totalSeconds, isRealistic };
}
