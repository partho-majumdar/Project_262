import React from 'react';
import { Crown, UserPlus, Users } from 'lucide-react';
import { timeAgo, PARTICIPANT_STATUS_LABEL } from './format';

export default function ParticipantList({ participants = [], myParticipantId }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
        <Users className="w-4 h-4 text-nexus-400" /> Participants ({participants.length})
      </h3>

      {participants.length === 0 ? (
        <p className="text-xs text-slate-500">No participants yet.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {participants.map((participant) => {
            const isMe = participant.id === myParticipantId;
            return (
              <li
                key={participant.id}
                className={`p-2.5 rounded-2xl border flex items-center gap-3 ${
                  isMe ? 'bg-nexus-950/60 border-nexus-600/60' : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ${
                    participant.leader
                      ? 'bg-amber-500/20 border border-amber-500/60 text-amber-300'
                      : 'bg-nexus-600/20 border border-nexus-500/40 text-nexus-300'
                  }`}
                >
                  {participant.initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                    {participant.displayName}
                    {isMe && <span className="text-[9px] text-nexus-300 font-bold">(You)</span>}
                    {participant.leader && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Group leader" />}
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                    {participant.quantity} {participant.quantity === 1 ? 'unit' : 'units'} · {timeAgo(participant.joinedAt)}
                    {participant.invited && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-400">
                        <UserPlus className="w-3 h-3" /> invited
                      </span>
                    )}
                  </p>
                  {participant.status !== 'JOINED' && (
                    <p className="text-[10px] text-slate-400">{PARTICIPANT_STATUS_LABEL[participant.status]}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
