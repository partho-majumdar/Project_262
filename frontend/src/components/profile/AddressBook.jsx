import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Check, Trash2, Home, Star } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

export default function AddressBook() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('United States');
  const [isDefault, setIsDefault] = useState(false);

  const fetchAddresses = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get('/users/addresses');
      setAddresses(response.data);
    } catch (err) {
      console.error('Failed to fetch addresses', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.post('/users/addresses', {
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        isDefault,
      });
      setIsModalOpen(false);
      resetForm();
      fetchAddresses();
    } catch (err) {
      alert(err.message || 'Failed to add address');
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      await axiosClient.put(`/users/addresses/${addressId}/set-default`);
      fetchAddresses();
    } catch (err) {
      alert(err.message || 'Failed to set default address');
    }
  };

  const handleDelete = async (addressId) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    try {
      await axiosClient.delete(`/users/addresses/${addressId}`);
      fetchAddresses();
    } catch (err) {
      alert(err.message || 'Failed to delete address');
    }
  };

  const resetForm = () => {
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setState('');
    setPostalCode('');
    setCountry('United States');
    setIsDefault(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Action Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-nexus-400" /> Saved Delivery Addresses
          </h3>
          <p className="text-xs text-slate-400">Manage shipping destinations and default delivery addresses</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 bg-nexus-600 hover:bg-nexus-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
        >
          <Plus className="w-4 h-4" /> Add Address
        </button>
      </div>

      {/* Address Cards Grid */}
      {loading ? (
        <div className="text-xs text-slate-400 py-8 text-center">Loading address book...</div>
      ) : addresses.length === 0 ? (
        <div className="glass-card p-8 text-center rounded-2xl space-y-2 border border-slate-800">
          <Home className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs font-semibold text-white">No Addresses Saved</p>
          <p className="text-[11px] text-slate-400">Add a primary shipping address for faster one-click checkout.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`glass-card p-5 rounded-2xl border space-y-3 flex flex-col justify-between ${
                addr.isDefault ? 'border-nexus-500/80 bg-nexus-950/30' : 'border-slate-800'
              }`}
            >
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{addr.addressLine1}</span>
                  {addr.isDefault && (
                    <span className="px-2.5 py-0.5 bg-nexus-950 border border-nexus-800 text-nexus-300 text-[10px] font-bold rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-nexus-400 text-nexus-400" /> Default Shipping Address
                    </span>
                  )}
                </div>
                {addr.addressLine2 && <p className="text-slate-300">{addr.addressLine2}</p>}
                <p className="text-slate-400">{addr.city}, {addr.state} {addr.postalCode}</p>
                <p className="text-slate-500 font-semibold">{addr.country}</p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                {!addr.isDefault ? (
                  <button
                    onClick={() => handleSetDefault(addr.id)}
                    className="text-nexus-400 hover:underline font-semibold"
                  >
                    Set as Default
                  </button>
                ) : (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Primary Address
                  </span>
                )}

                <button
                  onClick={() => handleDelete(addr.id)}
                  className="text-slate-400 hover:text-rose-400 p-1"
                  title="Delete Address"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Address Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl space-y-4 relative border border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <MapPin className="w-4 h-4 text-nexus-400" /> Add New Shipping Address
            </h3>

            <form onSubmit={handleAddAddress} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Street Address Line 1</label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="123 Innovation Way"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Street Address Line 2 (Optional)</label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Apt 2B"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Austin"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="TX"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="78701"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-nexus-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-800 text-nexus-500 focus:ring-0"
                />
                <label htmlFor="isDefault" className="text-slate-300">Set as default shipping address</label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-xl font-semibold"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
