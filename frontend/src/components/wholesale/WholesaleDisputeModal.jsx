import React, { useState } from 'react';
import { AlertCircle, Loader2, MessageSquareWarning, X } from 'lucide-react';
import { wholesaleApi, WHOLESALE_DISPUTE_TYPES } from '../../api/wholesaleApi';
import { apiErrorMessage } from '../../api/groupBuyApi';

export default function WholesaleDisputeModal({ isOpen, onClose, reservation, onSuccess }) {
  const [type, setType] = useState(WHOLESALE_DISPUTE_TYPES[0].id);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !reservation) return null;

  const handleSubmit = async () => {
    if (description.trim().length < 10) {
      setError('Describe the problem in at least 10 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const dispute = await wholesaleApi.openDispute(reservation.id, { type, description: description.trim() });
      onSuccess?.(dispute);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not submit your report.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="glass-panel bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <MessageSquareWarning className="w-5 h-5 text-rose-400" /> Report a problem
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400">
            Order {reservation.orderNumber} · {reservation.quantity} unit(s) of {reservation.productName}
          </p>
          <label className="block space-y-1.5 text-xs">
            <span className="font-bold text-slate-300">What went wrong?</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {WHOLESALE_DISPUTE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-xs">
            <span className="font-bold text-slate-300">Describe the problem</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              placeholder="Tell us what happened…"
            />
          </label>
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>
        <div className="p-5 border-t border-slate-800 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-[2] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}
