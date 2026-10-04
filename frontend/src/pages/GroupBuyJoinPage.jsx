import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, Ticket } from 'lucide-react';
import { groupBuyApi, apiErrorMessage } from '../api/groupBuyApi';
import { inviteRoute } from '../components/groupbuy/inviteCode';

/** Resolves an invite code (from a link, QR code or typed code) to its group page. */
export default function GroupBuyJoinPage() {
  const { inviteCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [code, setCode] = useState(inviteCode || '');

  useEffect(() => {
    let cancelled = false;
    setError('');
    groupBuyApi
      .getGroupByCode(inviteCode)
      .then((group) => {
        if (cancelled) return;
        const ref = searchParams.get('ref');
        navigate(`/group-buy/groups/${group.id}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`, { replace: true });
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, 'That invite code is not valid.'));
      });
    return () => {
      cancelled = true;
    };
  }, [inviteCode, searchParams, navigate]);

  if (!error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-xs text-slate-400">
        <Loader2 className="w-8 h-8 text-nexus-500 animate-spin" />
        Finding group {inviteCode?.toUpperCase()}…
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-16 space-y-5 text-center">
      <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-2xl text-rose-300 text-sm flex items-center justify-center gap-2">
        <AlertCircle className="w-4 h-4" /> {error}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const route = inviteRoute(code);
          if (route) navigate(route);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={200}
          placeholder="Paste the invite link or type the code"
          className="flex-1 bg-slate-950 border border-slate-800 focus:border-nexus-500 rounded-xl px-3 py-2.5 text-sm font-mono text-white"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <Ticket className="w-4 h-4" /> Find group
        </button>
      </form>
      <Link to="/group-deals" className="inline-flex items-center gap-2 text-nexus-400 hover:underline text-xs font-semibold">
        <ArrowLeft className="w-4 h-4" /> Browse group deals
      </Link>
    </div>
  );
}
