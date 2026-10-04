import React from 'react';

const TONES = {
  default: 'text-white',
  good: 'text-emerald-300',
  warn: 'text-amber-300',
  bad: 'text-rose-300',
};

export default function StatTile({ label, value, hint, tone = 'default' }) {
  return (
    <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
      <span className="text-[11px] text-slate-400 block font-semibold">{label}</span>
      <p className={`text-xl font-black font-mono ${TONES[tone] || TONES.default}`}>{value}</p>
      {hint && <span className="text-[10px] text-slate-500 block">{hint}</span>}
    </div>
  );
}
