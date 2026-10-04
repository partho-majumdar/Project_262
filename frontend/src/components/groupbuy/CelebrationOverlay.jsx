import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PartyPopper, X } from 'lucide-react';
import { formatMoney } from './format';

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#38bdf8'];

export default function CelebrationOverlay({ show, onClose, savings, orderNumber }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.6,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    [],
  );

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <style>{`@keyframes gb-confetti-fall {
        0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
        100% { transform: translateY(110vh) rotate(720deg); opacity: 0.2; }
      }`}</style>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((piece) => (
          <span
            key={piece.id}
            style={{
              position: 'absolute',
              top: 0,
              left: `${piece.left}%`,
              width: piece.size,
              height: piece.size * 0.6,
              backgroundColor: piece.color,
              borderRadius: 2,
              animation: `gb-confetti-fall ${piece.duration}s ease-in ${piece.delay}s forwards`,
            }}
          />
        ))}
      </div>

      <div
        className="relative bg-slate-900 border border-emerald-700/60 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center">
          <PartyPopper className="w-8 h-8 text-emerald-300" />
        </div>
        <h2 className="text-2xl font-extrabold text-white">Your group did it!</h2>
        <p className="text-sm text-slate-300">
          The group buy succeeded
          {Number(savings) > 0 && (
            <>
              {' '}and you saved <span className="font-bold text-emerald-300">{formatMoney(savings)}</span>
            </>
          )}
          .
        </p>
        {orderNumber && (
          <Link
            to={`/orders/confirmation/${orderNumber}`}
            className="inline-flex items-center justify-center w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition"
          >
            View order {orderNumber}
          </Link>
        )}
      </div>
    </div>
  );
}
