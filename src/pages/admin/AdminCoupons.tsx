import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuthStore } from '../../stores';
import { 
  Flame, 
  Award, 
  Plus, 
  Calendar, 
  ToggleLeft,
  CheckCircle, 
  Tag, 
  Clock, 
  Trash2,
  Percent,
  RefreshCw 
} from 'lucide-react';

export default function AdminCoupons() {
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  
  // Chakupita Sale State
  const [saleActive, setSaleActive] = useState(false);
  const [saleName, setSaleName] = useState('Chakupita Flash Sale');
  const [saleEndTime, setSaleEndTime] = useState('');
  
  // Coupons list
  const [coupons, setCoupons] = useState<any[]>([]);
  
  // Add Coupon Form State
  const [code, setCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState<number>(1000);
  const [minSpend, setMinSpend] = useState<number>(5000);
  const [expiryDate, setExpiryDate] = useState('');
  const [maxUses, setMaxUses] = useState<number>(100);
  const [isSaleCoupon, setIsSaleCoupon] = useState(false);

  // System states
  const [savingSettings, setSavingSettings] = useState(false);
  const [submittingCoupon, setSubmittingCoupon] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchSaleSettings();
    fetchCoupons();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSaleSettings = async () => {
    try {
      const docRef = doc(db, 'config', 'appSettings');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        setSaleActive(d.saleActive ?? false);
        setSaleName(d.saleName || 'Chakupita Flash Sale');
        
        // Handle expiration transform safely
        if (d.saleEndTime) {
          const dateStr = new Date(d.saleEndTime).toISOString().slice(0, 16);
          setSaleEndTime(dateStr);
        } else {
          // Default: 24h from now
          const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);
          setSaleEndTime(tomorrow);
        }
      } else {
        const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16);
        setSaleEndTime(tomorrow);
      }
    } catch (err) {
      console.error("Error loaded sale settings: ", err);
    }
  };

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'coupons'));
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setCoupons(list);
    } catch (err) {
      console.error("Error loading coupons list:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSaleSettings = async () => {
    setSavingSettings(true);
    try {
      const docRef = doc(db, 'config', 'appSettings');
      
      const payload = {
        saleActive,
        saleName: saleName.trim(),
        saleEndTime: new Date(saleEndTime).toISOString()
      };

      await setDoc(docRef, payload, { merge: true });

      // Audit Log
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: 'UPDATE_FLASH_SALE_CONFIG',
        targetId: 'config/appSettings',
        targetName: 'Chakupita Sale Manager',
        reason: `Config altered: Active=${saleActive}, Name="${saleName}"`,
        createdAt: serverTimestamp()
      });

      showToast("Chakupita Flash Sale parameters successfully updated!", "success");
    } catch (err) {
      console.error(err);
      showToast("Could not modify sale configurations.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      showToast("Coupon Promotion code is required.", "error");
      return;
    }

    setSubmittingCoupon(true);
    try {
      const cleanedCode = code.trim().toUpperCase();

      // Ensure unique code
      const codeExists = coupons.some(c => c.code === cleanedCode);
      if (codeExists) {
        showToast("Voucher code already active in catalog.", "error");
        setSubmittingCoupon(false);
        return;
      }

      const expiryIso = expiryDate ? new Date(expiryDate).toISOString() : new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

      const couponPayload = {
        code: cleanedCode,
        discountAmount: Number(discountAmount),
        minSpend: Number(minSpend),
        expiryDate: expiryIso,
        maxUses: Number(maxUses),
        usedCount: 0,
        isSaleCoupon,
        isActive: true,
        createdAt: new Date().toISOString()
      };

      // Save coupon doc directly (document ID matches code)
      await setDoc(doc(db, 'coupons', cleanedCode), couponPayload);

      // Audit Log
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: 'CREATE_PROMO_COUPON',
        targetId: cleanedCode,
        targetName: cleanedCode,
        reason: `Coupon created with MWK ${discountAmount} discount (Min spend MWK ${minSpend})`,
        createdAt: serverTimestamp()
      });

      showToast(`Promo voucher ${cleanedCode} created active!`, "success");
      
      // Reset form fields
      setCode('');
      setDiscountAmount(1000);
      setMinSpend(5000);
      setExpiryDate('');
      setMaxUses(100);
      setIsSaleCoupon(false);

      fetchCoupons();
    } catch (err) {
      console.error(err);
      showToast("Creation rejected by database constraints.", "error");
    } finally {
      setSubmittingCoupon(false);
    }
  };

  const handleToggleCouponActive = async (coupon: any) => {
    const nextActiveState = !coupon.isActive;
    try {
      await updateDoc(doc(db, 'coupons', coupon.id), {
        isActive: nextActiveState
      });

      // Audit Log
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: nextActiveState ? 'ACTIVATE_COUPON' : 'DEACTIVATE_COUPON',
        targetId: coupon.id,
        targetName: coupon.code,
        reason: 'Manually toggled availability status',
        createdAt: serverTimestamp()
      });

      showToast(`Promo state of voucher ${coupon.code} updated.`, "success");
      fetchCoupons();
    } catch (err) {
      console.error(err);
      showToast("Alteration request rejected.", "error");
    }
  };

  return (
    <div className="space-y-6" id="admin-coupons-root">
       
      {/* HUD Header Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-3xs">
        <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Promotions & Campaign Control</h2>
        <p className="text-[10px] text-slate-450 font-bold uppercase mt-0.5">Edit Chakupita flash configurations and issue discount vouchers</p>
      </div>

      {toast && (
        <div className={`p-3 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-xl text-xs font-bold`}>
           {toast.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5.5">
         
         {/* 1. FLASH SALE TUNING (COL 5) */}
         <div className="lg:col-span-5 bg-white p-5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-4">
           <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2.5">
             <Flame className="w-5 h-5 text-rose-600 animate-pulse" />
             <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wide">Chakupita Flash Sale Manager</h3>
           </div>

           <div className="space-y-4 font-sans text-xs font-semibold">
              <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl">
                <div>
                   <span className="text-[11px] font-black text-slate-800 block uppercase">Campaign Visibility</span>
                   <span className="text-[9.5px] text-slate-450 font-bold block mt-0.5">Activate or deactivate site-wide banner</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSaleActive(!saleActive)}
                  className={`p-2 px-4 text-[10.5px] font-black uppercase rounded-xl transition ${
                    saleActive 
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-3xs' 
                      : 'bg-slate-200 text-slate-650 hover:bg-slate-300'
                  }`}
                >
                  {saleActive ? 'Active ON' : 'Disabled'}
                </button>
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase text-slate-400">Marketing Campaign Title</label>
                 <input
                   type="text"
                   value={saleName}
                   onChange={(e) => setSaleName(e.target.value)}
                   placeholder="e.g. Chakupita Dziko Lathu Sale"
                   className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-rose-500"
                 />
              </div>

              <div className="space-y-1.5">
                 <label className="text-[10px] font-black uppercase text-slate-400">Target Expiration Time</label>
                 <input
                   type="datetime-local"
                   value={saleEndTime}
                   onChange={(e) => setSaleEndTime(e.target.value)}
                   className="w-full p-2.5 bg-slate-50 border border-slate-205 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-rose-500"
                 />
              </div>

              <div className="pt-2 border-t border-slate-50">
                <button
                  type="button"
                  onClick={handleSaveSaleSettings}
                  disabled={savingSettings}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-xs font-black uppercase transition-all shadow-3xs"
                >
                  {savingSettings ? 'Writing modifications...' : 'Save Sale Parameters'}
                </button>
              </div>
           </div>
         </div>

         {/* 2. CREATING PLATFORM DISCOUNTS (COL 7) */}
         <div className="lg:col-span-7 bg-white p-5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-4">
           <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2.5">
             <Plus className="w-5 h-5 text-indigo-600" />
             <h3 className="font-extrabold text-slate-850 text-xs uppercase tracking-wide">Generate Platform Voucher</h3>
           </div>

           <form onSubmit={handleCreateCoupon} className="space-y-3.5 font-sans text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-slate-400">Unique Code String</label>
                   <input
                     type="text"
                     placeholder="e.g. SAVE2000"
                     value={code}
                     onChange={(e) => setCode(e.target.value)}
                     className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                     required
                   />
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-slate-400">Discount Value (MWK)</label>
                   <input
                     type="number"
                     placeholder="2000"
                     value={discountAmount}
                     onChange={(e) => setDiscountAmount(Number(e.target.value))}
                     className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                     required
                   />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-slate-400">Minimum Basket Size (MWK)</label>
                   <input
                     type="number"
                     placeholder="5000"
                     value={minSpend}
                     onChange={(e) => setMinSpend(Number(e.target.value))}
                     className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500"
                     required
                   />
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-slate-400">Max Release Volume (Uses)</label>
                   <input
                     type="number"
                     placeholder="100"
                     value={maxUses}
                     onChange={(e) => setMaxUses(Number(e.target.value))}
                     className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                     required
                   />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center pt-1">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black uppercase text-slate-400">Expiry Date Threshold</label>
                   <input
                     type="datetime-local"
                     value={expiryDate}
                     onChange={(e) => setExpiryDate(e.target.value)}
                     className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-850"
                   />
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl self-end h-10.5">
                  <input
                    type="checkbox"
                    id="isSaleCoupon"
                    checked={isSaleCoupon}
                    onChange={(e) => setIsSaleCoupon(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-505"
                  />
                  <label htmlFor="isSaleCoupon" className="text-[10.5px] font-black uppercase text-slate-700 cursor-pointer select-none">
                     Is Campaign Sale Coupon
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-50">
                 <button
                   type="submit"
                   disabled={submittingCoupon}
                   className="w-full py-2.5 bg-indigo-605 hover:bg-indigo-700 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase transition shadow-3xs"
                 >
                   {submittingCoupon ? 'Generating code...' : 'Confirm Voucher Release'}
                 </button>
              </div>
           </form>
         </div>

      </div>

      {/* 3. COUPONS LEDGER LIST */}
      <div className="bg-white p-5 rounded-2.5xl border border-slate-100 shadow-3xs space-y-4">
        <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5 border-b pb-2">
          <Tag className="w-4.5 h-4.5 text-slate-500" /> Active Promotions Ledger
        </h3>

        {loading ? (
          <p className="text-center py-10 text-slate-450 font-bold text-xs">Querying promos registry...</p>
        ) : coupons.length === 0 ? (
          <p className="text-center py-12 text-slate-400 font-bold text-xs">No promotion vouchers released under the platform yet.</p>
        ) : (
          <div className="overflow-x-auto">
             <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b text-[8.5px] uppercase font-black text-slate-450">
                    <th className="p-3">Voucher Code</th>
                    <th className="p-3">Discount (MWK)</th>
                    <th className="p-3">Min Spend Size</th>
                    <th className="p-3 text-center">Traction / Uses</th>
                    <th className="p-3">Expiry Dateline</th>
                    <th className="p-3 text-right">Status State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-[11.5px] font-semibold text-slate-700">
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-slate-5/50 hover:bg-slate-50/50 transition">
                      <td className="p-3">
                         <span className="font-mono font-black text-slate-900 bg-slate-100 text-[10.5px] p-1 px-2.5 rounded-lg border">
                           {coupon.code}
                         </span>
                         {coupon.isSaleCoupon && (
                           <span className="ml-1.5 bg-red-105 bg-red-50 text-red-750 text-[8.5px] font-black uppercase tracking-wide px-1.5 rounded-md border border-red-150">Sale</span>
                         )}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">MWK {(coupon.discountAmount || 0).toLocaleString()}</td>
                      <td className="p-3 font-mono text-slate-500">MWK {(coupon.minSpend || 0).toLocaleString()}</td>
                      <td className="p-3 text-center font-mono">
                         <span className="text-indigo-600 font-bold">{coupon.usedCount || 0}</span>
                         <span className="text-slate-350"> / {coupon.maxUses || 100}</span>
                      </td>
                      <td className="p-3 text-slate-450 text-[10.5px]">
                         {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="p-3 text-right">
                         <button
                           onClick={() => handleToggleCouponActive(coupon)}
                           className={`p-1 px-3 text-[9px] font-black uppercase rounded-lg border transition ${
                             coupon.isActive 
                               ? 'bg-emerald-50 text-emerald-850 border-emerald-200' 
                               : 'bg-rose-50 text-rose-800 border-rose-200'
                           }`}
                         >
                           {coupon.isActive ? 'Active' : 'Offline'}
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        )}
      </div>

    </div>
  );
}
