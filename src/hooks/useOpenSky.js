import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchFlights, getDemoFlights } from '../services/opensky';

const REFRESH_INTERVAL = 60000; // 60s (OpenSky rate limit friendly)

export function useOpenSky() {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchFlights();
      setFlights(data);
      setError(null);
      setIsDemo(false);
      setLastUpdated(new Date());
    } catch (err) {
      // Fall back to demo data
      setFlights(getDemoFlights());
      setIsDemo(true);
      setError(err.message);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [load]);

  return { flights, loading, error, isDemo, lastUpdated, refresh: load };
}
