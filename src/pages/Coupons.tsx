import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { useAuthStore } from '../stores';
import { ArrowLeft, Ticket, Copy, Check, ExternalLink } from 'lucide-react';
import { OperationType } from '../types';

export default function Coupons() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'used' | 'expired'>('available');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch user's coupons subcollection
  const fetchUserCoupons = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // Fetch users/{uid}/coupons subcollection
      const colPath = `users/${user.uid}/coupons`;
      const qSnap = await getDocs(collection(db, colPath));
      const list: any[] = [];
      
      qSnap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });

      // For richer data card representation, load missing fields from main 'coupons' catalog where applicable
      const enrichedList: any[] = [];
      for (const item of list) {
        try {
          // Keep local subcollection fields as principal, fallback to primary /coupons/{code} docs
          const couponDocSnap = await getDoc(doc(db, 'coupons', item.id.toUpperCase()));
          if (couponDocSnap.exists()) {
            enrichedList.push({
              ...couponDocSnap.data(),
              ...item // merge subcollection state status/usedAt overriding general properties
            });
          } else {
            // Sane fallback
            enrichedList.push({
              code: item.id.toUpperCase(),
              discountAmount: item.discountAmount || 2000,
              minOrderValue: item.minOrderValue || 5000,
              expiresAt: item.expiresAt,
              status: item.status || 'available',
              ...item
            });
          }
        } catch (enrichErr) {
          enrichedList.push({
            code: item.id.toUpperCase(),
            discountAmount: item.discountAmount || 2000,
            minOrderValue: item.minOrderValue || 5000,
            expiresAt: item.expiresAt,
            status: item.status || 'available',
            ...item
          });
        }
      }

      setCoupons(enrichedList);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, `users/${user?.uid}/coupons`);
    }
  };

  useEffect(() => {
    fetchUserCoupons();
  }, [user?.uid]);

  // Clipboard copy handler
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  // Use Now -> store in local storage and redirect to marketplace
  const handleUseNow = (code: string) => {
    localStorage.setItem('shopeasy_active_coupon', code.toUpperCase());
    alert(`Coupon "${code}" saved! It will automatically apply on checkout where requirements are met. 🎫`);
    navigate('/shop');
  };

  // Partition tabs
  const now = new Date();

  const availableCoupons = coupons.filter(c => {
    const expDate = c.expiresAt?.toDate ? c.expiresAt.toDate() : (c.expiresAt ? new Date(c.expiresAt) : null);
    const isExpired = expDate ? now > expDate : false;
    return (c.status === 'available' || !c.status) && !isExpired;
  });

  const usedCoupons = coupons.filter(c => c.status === 'used');

  const expiredCoupons = coupons.filter(c => {
    const expDate = c.expiresAt?.toDate ? c.expiresAt.toDate() : (c.expiresAt ? new Date(c.expiresAt) : null);
    const isExpired = expDate ? now > expDate : false;
    return c.status === 'expired' || ((c.status === 'available' || !c.status) && isExpired);
  });

  const getActiveList = () => {
    if (activeTab === 'available') return availableCoupons;
    if (activeTab === 'used') return usedCoupons;
    return expiredCoupons;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'No limit';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <button 
          onClick={() => navigate('/account')}
          className="p-1 text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-display font-black text-sm text-neutral-900">
          My Coupons & Promos
        </span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* TABS SELECTOR */}
        <div className="bg-white border border-neutral-100 p-1 rounded-2xl shadow-sm grid grid-cols-3 gap-1">
          <button
            onClick={() => setActiveTab('available')}
            className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all ${
              activeTab === 'available'
                ? 'bg-[#E42525] text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Available ({availableCoupons.length})
          </button>
          <button
            onClick={() => setActiveTab('used')}
            className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all ${
              activeTab === 'used'
                ? 'bg-[#E42525] text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Used ({usedCoupons.length})
          </button>
          <button
            onClick={() => setActiveTab('expired')}
            className={`py-2 px-1 rounded-xl text-[10px] sm:text-xs font-black transition-all ${
              activeTab === 'expired'
                ? 'bg-[#E42525] text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Expired ({expiredCoupons.length})
          </button>
        </div>

        {/* LOADING & LIST CONTENT */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#E42525] border-t-transparent animate-spin"></div>
            <p className="text-xs text-neutral-500 font-bold mt-3">Kutsitsa makuponi...</p>
          </div>
        ) : getActiveList().length === 0 ? (
          /* EMPTY TAB STATE */
          <div className="text-center py-16 px-4 bg-white rounded-3xl border border-neutral-100 shadow-sm flex flex-col items-center justify-center">
            <Ticket className="h-12 w-12 text-neutral-300 mb-3" />
            <p className="text-xs text-neutral-500 font-bold">No {activeTab} coupons found</p>
            <p className="text-[10px] text-neutral-400 mt-1 max-w-[200px] leading-relaxed">
              Check out our sales events or grab platform offers from other campaigns!
            </p>
          </div>
        ) : (
          /* COUPON CARDS */
          <div className="flex flex-col gap-3.5">
            {getActiveList().map((coupon) => {
              const isAvailable = activeTab === 'available';
              const codeStr = (coupon.code || coupon.id || '').toUpperCase();

              return (
                <div 
                  key={coupon.id} 
                  className="bg-white rounded-2xl border border-neutral-150 overflow-hidden flex shadow-sm relative"
                >
                  {/* LEFT VERTICAL ACCENT BAND */}
                  <div className={`w-3.5 shrink-0 ${isAvailable ? 'bg-[#E42525]' : 'bg-neutral-350'}`}></div>

                  {/* CARDS BODY */}
                  <div className="flex-1 p-4 flex items-center justify-between gap-3">
                    {/* Left content details */}
                    <div className="flex-1 flex flex-col gap-1">
                      <h3 className="font-display font-black text-sm text-neutral-900 leading-tight">
                        MWK {coupon.discountAmount ? coupon.discountAmount.toLocaleString() : '0'} OFF
                      </h3>
                      <p className="text-[10px] text-neutral-500 font-bold leading-normal">
                        Minimum order: MWK {coupon.minOrderValue ? coupon.minOrderValue.toLocaleString() : '0'}
                      </p>
                      
                      <p className="text-[9px] text-neutral-400 font-semibold mt-1">
                        {activeTab === 'available' && `Valid until: ${formatDate(coupon.expiresAt)}`}
                        {activeTab === 'used' && `Used on: ${formatDate(coupon.usedAt || coupon.expiresAt)}`}
                        {activeTab === 'expired' && `Expired on: ${formatDate(coupon.expiresAt)}`}
                      </p>
                    </div>

                    {/* Right interactive segment */}
                    <div className="flex flex-col items-end gap-2.5 pl-3.5 border-l border-neutral-100">
                      {/* Code display with copy button */}
                      <button 
                        onClick={() => handleCopyCode(codeStr)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-[11px] font-mono font-black rounded-lg transition-all"
                      >
                        <span>{codeStr}</span>
                        {copiedCode === codeStr ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-neutral-500" />
                        )}
                      </button>

                      {/* Use Now link redirection */}
                      {isAvailable && (
                        <button
                          onClick={() => handleUseNow(codeStr)}
                          className="text-[10px] font-black uppercase text-[#E42525] hover:underline flex items-center gap-0.5 tracking-wider"
                        >
                          Use Now →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BOTTOM REDIRECT TO DISCOVER MORE COUPONS */}
        <div className="mt-4 flex flex-col items-center">
          <button
            onClick={() => navigate('/sale/coupons')}
            className="w-full flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-650 hover:to-rose-750 text-white rounded-2xl transition-all font-display font-black text-xs uppercase tracking-widest shadow-md"
          >
            <span>Get More Coupons 🎟️</span>
          </button>
        </div>
      </div>
    </div>
  );
}
