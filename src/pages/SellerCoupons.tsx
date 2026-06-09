import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { 
  ArrowLeft, 
  Ticket, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  Layers, 
  Check, 
  AlertCircle,
  FolderOpen
} from 'lucide-react';

export default function SellerCoupons() {
  const uid = auth.currentUser?.uid;

  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form Fields
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [minOrder, setMinOrder] = useState<number | ''>('');
  const [expiry, setExpiry] = useState('');
  const [maxUses, setMaxUses] = useState<number | ''>(100);

  // Layout status fields
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!uid) return;
    fetchCoupons();
  }, [uid]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      // Query coupons created by this seller uid
      const q = query(
        collection(db, 'coupons'),
        where('createdBy', '==', uid)
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setCoupons(list);
    } catch (err) {
      console.error("Error loaded store discount coupons:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCouponActive = async (couponId: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, 'coupons', couponId), {
        isActive: !currentActive
      });
      alert(`✓ Coupon status updated to ${!currentActive ? 'ACTIVE' : 'DEACTIVATED'}.`);
      fetchCoupons();
    } catch (err: any) {
      alert("Error toggling coupon state: " + err.message);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this coupon? Buyers will no longer be able to apply it.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'coupons', couponId));
      alert("✓ Coupon deleted successfully.");
      fetchCoupons();
    } catch (err: any) {
      alert("Error deleting coupon document: " + err.message);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');

    if (!code.trim()) {
      setErrorText('Coupon Code is required');
      return;
    }
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    if (cleanCode.length < 4) {
      setErrorText('Coupon Code should be at least 4 characters alphanumeric');
      return;
    }
    if (amount === '' || Number(amount) <= 0) {
      setErrorText('Discount amount in MWK is required to be at least 100 MWK');
      return;
    }
    if (minOrder === '' || Number(minOrder) < Number(amount)) {
      setErrorText('Minimum order value must be equal or greater than the discount value');
      return;
    }
    if (!expiry) {
      setErrorText('Please specify a valid expiration date');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: cleanCode,
        discountAmount: Number(amount),
        minOrderValue: Number(minOrder),
        validTo: expiry,
        maxUses: maxUses === '' ? 100 : Number(maxUses),
        usedCount: 0,
        isActive: true,
        createdBy: uid,
        type: 'seller', // scope to store coupons
        storeId: uid,
        createdAt: serverTimestamp()
      };

      // Set coupon code as firestore document name to prevent duplicate identical codes
      await setDoc(doc(db, 'coupons', cleanCode), payload);

      alert(`✓ Coupon "${cleanCode}" created successfully!`);
      setShowCreateForm(false);
      
      // Reset form variables
      setCode('');
      setAmount('');
      setMinOrder('');
      setExpiry('');
      setMaxUses(100);

      fetchCoupons();
    } catch (err: any) {
      console.error("Created coupon error:", err);
      setErrorText('Failed to save coupon code: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" id="seller-coupons-control">
      
      {/* Top Banner & trigger */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-850 to-indigo-800 text-white p-4.5 rounded-2xl flex justify-between items-center relative overflow-hidden border border-indigo-750">
        <div className="absolute right-[-10px] top-[-10px] text-7xl opacity-10 select-none">
          🎟️
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-white text-base">Store Coupons</h3>
          <p className="text-[10px] text-indigo-200">
            Create custom discount codes to reward followers and boost order conversion!
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowCreateForm(!showCreateForm)}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-1 uppercase tracking-wider shadow-3xs"
      >
        <Plus className="w-4.5 h-4.5" /> {showCreateForm ? 'Close Creator Form' : 'Create New Coupon'}
      </button>

      {/* creator form panel */}
      {showCreateForm && (
        <form onSubmit={handleCreateCoupon} className="bg-white rounded-2xl p-5 border shadow-3xs space-y-4.5 animate-[fadeIn_0.15s_ease]">
          <div className="border-b border-slate-100 pb-2 flex items-center gap-1.5 text-indigo-900">
            <Ticket className="w-4.5 h-4.5 text-indigo-600" />
            <span className="font-bold text-xs uppercase tracking-wider">Coupon Configuration</span>
          </div>

          {errorText && (
            <div className="bg-rose-50 border border-rose-250 p-2.5 rounded-xl text-rose-800 font-bold text-xs">
              {errorText}
            </div>
          )}

          {/* Code input */}
          <div>
            <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
              Discount Code *
            </label>
            <input 
              type="text"
              placeholder="E.g. BUYLOCAL100"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full text-xs font-mono font-black uppercase px-3.5 py-3 border focus:border-indigo-600 focus:outline-none rounded-xl text-slate-900 bg-slate-50/50" 
            />
            <span className="text-[9.5px] text-slate-400 block mt-1">Sellers name coupon code must be unique (uppercase characters, no spaces)</span>
          </div>

          {/* Amount and Minimal order */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Discount (MWK) *
              </label>
              <input 
                type="number"
                placeholder="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs font-bold px-3 py-2.5 border focus:outline-none rounded-xl bg-slate-50/50" 
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Min Order (MWK) *
              </label>
              <input 
                type="number"
                placeholder="5000"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs font-bold px-3 py-2.5 border focus:outline-none rounded-xl bg-slate-50/50" 
              />
            </div>
          </div>

          {/* Expiry and capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1 font-sans">
                Expiry Date *
              </label>
              <input 
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-2 border focus:outline-none rounded-xl bg-slate-50/50" 
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Max Uses Count
              </label>
              <input 
                type="number"
                placeholder="100"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full text-xs font-bold px-3 py-2.5 border focus:outline-none rounded-xl bg-slate-50/50" 
              />
            </div>
          </div>

          {/* Actions button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition uppercase tracking-wider shadow-sm flex items-center justify-center gap-1"
          >
            {saving ? 'Creating coupon...' : 'Save and Publish Coupon →'}
          </button>
        </form>
      )}

      {/* Coupons lists */}
      {loading ? (
        <div className="py-12 flex justify-center text-slate-400 text-xs text-center font-bold">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2" />
          Loading store vouchers list...
        </div>
      ) : coupons.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border text-center text-slate-400 text-xs space-y-2">
          <FolderOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold">No coupons created yet.</p>
          <p className="text-[10px] text-slate-400">Vouchers allow giving discount values to shoppers. Click button above to start.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((cop) => {
            const isInactive = cop.isActive === false;
            
            // Calculate expired
            const expDate = new Date(cop.validTo);
            const isExpired = expDate < new Date();

            return (
              <div 
                key={cop.id}
                className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-3xs flex justify-between items-center gap-3 relative overflow-hidden transition duration-150 ${isInactive || isExpired ? 'opacity-70 bg-slate-50/60' : ''}`}
              >
                {/* Left Ticket styling */}
                <div className="space-y-2 flex-1 min-w-0 pr-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-indigo-950 uppercase bg-indigo-50 border border-indigo-150 rounded px-2.5 py-0.5 tracking-wide">
                      {cop.code}
                    </span>
                    {(isExpired || isInactive) && (
                      <span className="text-[9px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-black uppercase">
                        {isExpired ? 'Expired' : 'Disabled'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-slate-700">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-650">
                      <span>MWK {cop.discountAmount?.toLocaleString()} OFF coupon</span>
                    </div>
                    <div className="text-[10.5px] text-slate-450 font-bold uppercase font-sans flex items-center gap-2 flex-wrap">
                      <span>Min Order: MWK {cop.minOrderValue?.toLocaleString()}</span>
                      <span>•</span>
                      <span>Capacity: {cop.usedCount || 0}/{cop.maxUses || 100} used</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-slate-300" /> Runs to: {cop.validTo}
                    </div>
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <button
                    onClick={() => handleToggleCouponActive(cop.id, cop.isActive)}
                    className={`font-sans font-bold text-[10px] uppercase py-1.5 px-3 rounded-lg border transition tracking-wide select-none ${
                      isInactive 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {isInactive ? 'Enable' : 'Disable'}
                  </button>

                  <button
                    onClick={() => handleDeleteCoupon(cop.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete coupon permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
