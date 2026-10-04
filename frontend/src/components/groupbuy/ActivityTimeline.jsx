import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Crown,
  Flag,
  LogOut,
  PartyPopper,
  Timer,
  TrendingDown,
  UserPlus,
  XCircle,
  Zap,
} from 'lucide-react';
import { timeAgo } from './format';

const TYPE_META = {
  GROUP_STARTED: { icon: Flag, className: 'text-nexus-400' },
  MEMBER_JOINED: { icon: UserPlus, className: 'text-emerald-400' },
  INVITE_JOINED: { icon: UserPlus, className: 'text-teal-400' },
  MEMBER_LEFT: { icon: LogOut, className: 'text-slate-400' },
  LEADER_CHANGED: { icon: Crown, className: 'text-amber-400' },
  TIER_UNLOCKED: { icon: TrendingDown, className: 'text-emerald-400' },
  ALMOST_THERE: { icon: Zap, className: 'text-amber-300' },
  GOAL_REACHED: { icon: CheckCircle2, className: 'text-emerald-400' },
  EXPIRING_SOON: { icon: Timer, className: 'text-rose-400' },
  GROUP_SUCCEEDED: { icon: PartyPopper, className: 'text-emerald-300' },
  GROUP_FAILED: { icon: AlertTriangle, className: 'text-rose-400' },
  GROUP_CANCELLED: { icon: XCircle, className: 'text-slate-400' },
};

export default function ActivityTimeline({ activities = [] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
        <Activity className="w-4 h-4 text-indigo-400" /> Group activity
      </h3>

      {activities.length === 0 ? (
        <p className="text-xs text-slate-500">No activity yet.</p>
      ) : (
        <ol className="relative border-l border-slate-800 ml-2 space-y-3">
          {activities.map((item, index) => {
            const meta = TYPE_META[item.type] || { icon: Activity, className: 'text-slate-400' };
            const Icon = meta.icon;
            return (
              <li key={`${item.type}-${item.createdAt}-${index}`} className="ml-4">
                <span className="absolute -left-[9px] mt-0.5 w-[18px] h-[18px] rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center">
                  <Icon className={`w-3 h-3 ${meta.className}`} />
                </span>
                <p className="text-xs text-slate-200 leading-snug">{item.message}</p>
                <p className="text-[10px] text-slate-500">{timeAgo(item.createdAt)}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
