import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getSubsolarPoint, cosSolarZenith } from '../../utils/solar';

// Renders a canvas night shadow directly inside the Leaflet map container.
// Step=4px sampling → ~80k calculations for a 1280×800 map, runs in <10ms.
export function DayNightLayer({ opacity = 0.55 }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '500',
      opacity: String(opacity),
    });
    container.appendChild(canvas);

    let rafId = null;

    function redraw() {
      const rect = container.getBoundingClientRect();
      const W = Math.floor(rect.width);
      const H = Math.floor(rect.height);
      if (!W || !H) return;

      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      const solar = getSubsolarPoint();
      const STEP  = 8; // 4x fewer pixels than STEP=4 — imperceptible quality diff

      const imgData = ctx.createImageData(W, H);

      for (let py = 0; py < H; py += STEP) {
        for (let px = 0; px < W; px += STEP) {
          const ll = map.containerPointToLatLng(L.point(px + 1, py + 1));
          const cosZ = cosSolarZenith(ll.lat, ll.lng, solar);

          if (cosZ < 0.08) {  // night + civil twilight
            // Smooth fade: full dark at cosZ≤-0.15, twilight glow at cosZ>0
            const depth  = Math.min(1, Math.max(0, (0.08 - cosZ) / 1.1));
            const alpha  = Math.round(depth * 210);
            const glow   = Math.max(0, (0.08 - Math.abs(cosZ)) / 0.08); // terminator glow

            for (let dy = 0; dy < STEP && py + dy < H; dy++) {
              for (let dx = 0; dx < STEP && px + dx < W; dx++) {
                const i = ((py + dy) * W + (px + dx)) * 4;
                imgData.data[i]     = Math.round(glow * 30);  // slight orange at terminator
                imgData.data[i + 1] = Math.round(glow * 15);
                imgData.data[i + 2] = Math.round(20 + glow * 5);
                imgData.data[i + 3] = alpha;
              }
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    const onMapChange = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(redraw);
    };

    map.on('moveend zoomend resize', onMapChange);
    redraw();
    const ticker = setInterval(redraw, 60_000); // keep up with real time

    return () => {
      map.off('moveend zoomend resize', onMapChange);
      clearInterval(ticker);
      cancelAnimationFrame(rafId);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [map, opacity]);

  return null;
}
