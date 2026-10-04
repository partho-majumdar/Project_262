import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Link2, MessageCircle, QrCode, Share2 } from 'lucide-react';
import { formatMoney } from './format';

export default function ShareGroupPanel({ group, inviterUserId }) {
  const [copied, setCopied] = useState('');
  const [showQr, setShowQr] = useState(false);

  const inviteUrl = `${window.location.origin}/group-buy/join/${group.inviteCode}${
    inviterUserId ? `?ref=${inviterUserId}` : ''
  }`;
  const productName = group.campaign?.productName || 'this deal';
  const shareText =
    `Join my GroupMart group for ${productName}! The more people join, the lower the price ` +
    `(as low as ${formatMoney(group.campaign?.lowestPrice)} each). ` +
    `Use code ${group.inviteCode} or open ${inviteUrl}`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: 'GroupMart group buy', text: shareText, url: inviteUrl });
    } catch {
      // share sheet dismissed
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
        <Share2 className="w-4 h-4 text-nexus-400" /> Invite friends
      </h3>

      <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1 text-center">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Group code</p>
        <div className="flex items-center justify-center gap-2">
          <span className="font-mono text-2xl font-extrabold tracking-[0.25em] text-white">{group.inviteCode}</span>
          <button
            type="button"
            onClick={() => copy(group.inviteCode, 'code')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Copy code"
          >
            {copied === 'code' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-xl">
        <Link2 className="w-4 h-4 text-slate-500 shrink-0" />
        <span className="text-[11px] text-slate-400 truncate flex-1 font-mono">{inviteUrl}</span>
        <button
          type="button"
          onClick={() => copy(inviteUrl, 'link')}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 transition shrink-0"
        >
          {copied === 'link' ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </a>
        <button
          type="button"
          onClick={() => setShowQr((value) => !value)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold transition"
        >
          <QrCode className="w-4 h-4" /> {showQr ? 'Hide QR' : 'QR code'}
        </button>
        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-nexus-600 hover:bg-nexus-500 text-white text-xs font-bold transition"
          >
            <Share2 className="w-4 h-4" /> Share…
          </button>
        )}
      </div>

      {showQr && (
        <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl">
          <QRCodeSVG value={inviteUrl} size={168} bgColor="#ffffff" fgColor="#0f172a" marginSize={2} />
          <p className="text-[11px] text-slate-600 font-semibold">Scan to join group {group.inviteCode}</p>
        </div>
      )}
    </div>
  );
}
