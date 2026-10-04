import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Timer } from 'lucide-react';

const pad = (n) => String(n).padStart(2, '0');

export default function CountdownTimer({ expiresAt, onExpire, variant = 'full', label = 'Ends in' }) {
  const target = useMemo(() => (expiresAt ? new Date(expiresAt).getTime() : null), [expiresAt]);
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    firedRef.current = false;
  }, [target]);

  const remaining = target ? Math.max(0, target - now) : 0;

  useEffect(() => {
    if (target && remaining === 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [remaining, target, onExpire]);

  if (!target) return null;

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ended = remaining === 0;
  const urgent = !ended && remaining < 60 * 60 * 1000;

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold ${
          ended ? 'text-slate-500' : urgent ? 'text-rose-400' : 'text-amber-300'
        }`}
      >
        <Timer className="w-3.5 h-3.5" />
        {ended ? 'Ended' : `${days > 0 ? `${days}d ` : ''}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`}
      </span>
    );
  }

  const units = [
    ...(days > 0 ? [{ label: 'Days', value: days }] : []),
    { label: 'Hours', value: hours },
    { label: 'Min', value: minutes },
    { label: 'Sec', value: seconds },
  ];

  return (
    <div className="space-y-1.5">
      <span
        className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
          urgent ? 'text-rose-400' : 'text-slate-400'
        }`}
      >
        <Timer className="w-3.5 h-3.5" /> {ended ? 'Timer ended' : label}
      </span>
      <div className="flex gap-2">
        {units.map((unit) => (
          <div
            key={unit.label}
            className={`min-w-[52px] px-2 py-1.5 rounded-xl border text-center ${
              urgent ? 'bg-rose-950/50 border-rose-800' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <div className={`font-mono text-lg font-extrabold ${urgent ? 'text-rose-300' : 'text-white'}`}>
              {pad(unit.value)}
            </div>
            <div className="text-[9px] text-slate-500 font-bold uppercase">{unit.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
