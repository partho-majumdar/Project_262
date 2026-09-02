import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Check, X } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

export default function AddressSelectorModal({ isOpen, onClose, selectedAddressId, onSelectAddress }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Backend CreateAddressRequest fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [apartment, setApartment] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('United States');

  const resetForm = () => {
    setFullName('');
    setPhone('');
    setStreetAddress('');
    setApartment('');
    setCity('');
    setState('');
    setPostalCode('');
    setCountry('United States');
    setError(null);
  };

  const extractList = (res) => {
    const payload = res?.data ?? res;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.content)) return payload.content;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  };

  const fetchAddresses = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get('/users/addresses');
      setAddresses(extractList(response));
    } catch (err) {
      console.error('Failed to fetch addresses', err);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAddresses();
      setShowAddForm(false);
      resetForm();
    }
  }, [isOpen]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !phone.trim() || !streetAddress.trim() ||
        !city.trim() || !state.trim() || !postalCode.trim() || !country.trim()) {
      setError('Please fill in all required fields (name, phone, street, city, state, postal code, country).');
      return;
    }

    setSaving(true);
    try {
      // Must match backend CreateAddressRequest exactly
      const body = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        streetAddress: streetAddress.trim(),
        apartment: apartment.trim() || null,
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
        addressType: 'SHIPPING',
        isDefault: addresses.length === 0,
      };

      const response = await axiosClient.post('/users/addresses', body);
      const created = response?.data ?? response;

      const next = [...addresses, created];
      setAddresses(next);
      if (onSelectAddress) onSelectAddress(created);
      setShowAddForm(false);
      resetForm();
      onClose?.();
    } catch (err) {
      console.error('Failed to add address', err);
      const msg =
        err?.message ||
        (Array.isArray(err?.errors) ? err.errors.join(', ') : null) ||
        (typeof err?.errors === 'object' && err.errors
          ? Object.values(err.errors).flat().join(', ')
          : null) ||
        'Failed to add address. Check required fields.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const formatAddrTitle = (addr) =>
    addr.fullName || addr.streetAddress || addr.addressLine1 || 'Address';

  const formatStreet = (addr) =>
    addr.streetAddress || addr.addressLine1 || '';

  const formatApt = (addr) =>
    addr.apartment || addr.addressLine2 || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg p-6 rounded-3xl space-y-6 relative max-h-[85vh] overflow-y-auto border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-nexus-400" /> Select Delivery Address
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!showAddForm ? (
          <div className="space-y-4">
            {loading ? (
              <p className="text-xs text-slate-400 text-center py-4">Loading saved addresses...</p>
            ) : addresses.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <MapPin className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No delivery addresses saved in your address book.</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl text-xs font-semibold"
                >
                  Add New Delivery Address
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    onClick={() => {
                      onSelectAddress?.(addr);
                      onClose?.();
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      selectedAddressId === addr.id
                        ? 'bg-nexus-950/60 border-nexus-500 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">{formatAddrTitle(addr)}</span>
                        {addr.isDefault && (
                          <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-bold rounded">
                            Default
                          </span>
                        )}
                      </div>
                      {addr.phone && <p className="text-slate-400">{addr.phone}</p>}
                      <p className="text-slate-300">{formatStreet(addr)}</p>
                      {formatApt(addr) && <p className="text-slate-400">{formatApt(addr)}</p>}
                      <p className="text-slate-400">
                        {addr.city}, {addr.state} {addr.postalCode}
                      </p>
                      <p className="text-slate-500">{addr.country}</p>
                    </div>
                    {selectedAddressId === addr.id && (
                      <Check className="w-5 h-5 text-nexus-400 shrink-0" />
                    )}
                  </div>
                ))}

                <button
                  onClick={() => {
                    resetForm();
                    setShowAddForm(true);
                  }}
                  className="w-full py-3 bg-slate-900 border border-dashed border-slate-700 hover:border-nexus-500 text-slate-300 hover:text-white rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4 text-nexus-400" /> Add Another Delivery Address
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="px-3 py-2 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Phone *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Street Address *</label>
              <input
                type="text"
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="123 Tech Boulevard"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Apartment / Suite (Optional)</label>
              <input
                type="text"
                value={apartment}
                onChange={(e) => setApartment(e.target.value)}
                placeholder="Suite 400"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">City *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="San Francisco"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">State / Province *</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="CA"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Postal / Zip Code *</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="94105"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Country *</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                  required
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setError(null);
                }}
                className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl font-semibold"
              >
                Back to Address List
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-nexus-600 hover:bg-nexus-500 disabled:opacity-50 text-white rounded-xl font-semibold"
              >
                {saving ? 'Saving…' : 'Save & Select Address'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}