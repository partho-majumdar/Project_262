import React from 'react';
import { Users } from 'lucide-react';

export default function GroupProgress({
  participantCount = 0,
  minParticipants = 0,
  maxParticipants = 0,
  spotsToMinimum = 0,
  spotsLeft = 0,
  almostThere = false,
  compact = false,
}) {
  const percent = minParticipants > 0 ? Math.min(100, Math.round((participantCount / minParticipants) * 100)) : 100;
  const goalReached = participantCount >= minParticipants;

  const barClass = goalReached
    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
    : almostThere
      ? 'bg-gradient-to-r from-amber-500 to-orange-400 animate-pulse'
      : 'bg-gradient-to-r from-nexus-600 to-indigo-500';

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between text-xs gap-2">
        <span className="flex items-center gap-1.5 font-bold text-white">
          <Users className="w-4 h-4 text-nexus-400" />
          <span className={`font-mono ${compact ? 'text-sm' : 'text-lg'}`}>{participantCount}</span>
          <span className="text-slate-400 font-semibold">joined</span>
        </span>
        <span
          className={
            goalReached
              ? 'text-emerald-400 font-bold'
              : almostThere
                ? 'text-amber-300 font-bold'
                : 'text-slate-400 font-semibold'
          }
        >
          {goalReached ? 'Goal reached' : `${spotsToMinimum} more needed`}
        </span>
      </div>
      <div
        className={`${compact ? 'h-2' : 'h-3'} bg-slate-950 border border-slate-800 rounded-full overflow-hidden`}
        role="progressbar"
        aria-valuenow={participantCount}
        aria-valuemin={0}
        aria-valuemax={minParticipants}
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ${barClass}`}
          style={{ width: `${Math.max(percent, 4)}%` }}
        />
      </div>
      {!compact && (
        <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
          <span>Minimum group size: {minParticipants}</span>
          <span>
            {spotsLeft} of {maxParticipants} spots left
          </span>
        </div>
      )}
    </div>
  );
}
