import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  setDoc, 
  updateDoc, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { useAuthStore } from '../stores';
import { ArrowLeft, Flame, Clock, Award, CheckCircle2, AlertCircle } from 'lucide-react';
import { OperationType } from '../types';

export default function SaleCoupons() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saleSettings, setSaleSettings] = useState({
    saleActive: true,
    saleName: 'ShopEasy Kulimbitsa',
    saleEndTime: new Date(Date.now() + 48 * 3600 * 1000).toISOString() // default 48h from now
  });

  const [saleCoupons, setSaleCoupons] = useState<any[]>([]);
  const [userCollectedCodes, setUserCollectedCodes] = useState<string[]>([]);
  const [collectingCode, setCollectingCode] = useState<string | null>(null);

  // Countdown timer string
  const [timeLeftString, setTimeLeftString] = useState('00h : 00m : 00s');

  const fetchSaleData = async () => {
    setLoading(true);
    try {
      // 1. Fetch config/appSettings
      const settingsSnap = await getDoc(doc(db, 'config', 'appSettings'));
      let activeEndTime = saleSettings.saleEndTime;
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        setSaleSettings({
          saleActive: data.saleActive ?? true,
          saleName: data.saleName || 'ShopEasy Kulimbitsa',
          saleEndTime: data.saleEndTime || activeEndTime
        });
        activeEndTime = data.saleEndTime || activeEndTime;
      }

      // 2. Fetch coupons where isSaleCoupon == true AND isActive == true order by discountAmount desc
      const couponsQuery = query(
        collection(db, 'coupons'),
        where('isSaleCoupon', '==', true),
        where('isActive', '==', true)
      );
      const couponsSnap = await getDocs(couponsQuery);
      const list: any[] = [];
      couponsSnap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });

      // Sort desc by discountAmount locally
      list.sort((a, b) => (b.discountAmount || 0) - (a.discountAmount || 0));
      setSaleCoupons(list);

      // 3. Fetch user's collected coupon codes to overlay "Collected" state
      if (user?.uid) {
        const userCouponsSnap = await getDocs(collection(db, 'users', user.uid, 'coupons'));
        const collected: string[] = [];
        userCouponsSnap.forEach((docSnap) => {
          collected.push(docSnap.id.toUpperCase());
        });
        setUserCollectedCodes(collected);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, 'coupons/sale_settings');
    }
  };

  // Run on load and whenever user state changes
  useEffect(() => {
    fetchSaleData();
  }, [user?.uid]);

  // Live countdown runner
  useEffect(() => {
    const interval = setInterval(() => {
      const targetTime = new Date(saleSettings.saleEndTime).getTime();
      const difference = targetTime - Date.now();

      if (difference <= 0) {
        setTimeLeftString('Sale Ended!');
        clearInterval(interval);
      } else {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        const hrsStr = String(hours).padStart(2, '0');
        const minsStr = String(minutes).padStart(2, '0');
        const secsStr = String(seconds).padStart(2, '0');

        setTimeLeftString(`${hrsStr}h : ${minsStr}m : ${secsStr}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [saleSettings.saleEndTime]);

  // Collect action handler
  const handleCollectCoupon = async (coupon: any) => {
    if (!user?.uid) {
      alert("Chonde lowani kaye kuti mutenge kuponi iyi / Please login description.");
      navigate('/login');
      return;
    }

    const codeUpper = coupon.code.toUpperCase().trim();
    setCollectingCode(codeUpper);

    try {
      // 1. Check if user already has it (double security validation)
      const collRef = doc(db, 'users', user.uid, 'coupons', codeUpper);
      const checkSnap = await getDoc(collRef);
      if (checkSnap.exists()) {
        alert("Collected ✓ You already collected this coupon.");
        setUserCollectedCodes(prev => [...prev, codeUpper]);
        setCollectingCode(null);
        return;
      }

      // 2. Validate current usage bounds
      if (coupon.usedCount !== undefined && coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses) {
        alert("All taken! This coupon has run out of supplies.");
        setCollectingCode(null);
        return;
      }

      // 3. Write user's receipt doc
      const expiresAtValue = coupon.expiresAt || new Date(Date.now() + 7 * 24 * 365 * 1000).toISOString();
      await setDoc(collRef, {
        code: codeUpper,
        discountAmount: coupon.discountAmount,
        minOrderValue: coupon.minOrderValue || 0,
        expiresAt: expiresAtValue,
        status: 'available',
        collectedAt: serverTimestamp()
      });

      // 4. Increment coupon's counter
      const couponRef = doc(db, 'coupons', codeUpper);
      await updateDoc(couponRef, {
        usedCount: increment(1)
      });

      // 5. Update UI
      setUserCollectedCodes(prev => [...prev, codeUpper]);
      setCollectingCode(null);
      alert(`Success! Coupon "${codeUpper}" collected! Check your wallet to use it during purchase! 🎟️`);
    } catch (err) {
      setCollectingCode(null);
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/coupons/${codeUpper}`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 text-white pb-24">
      {/* HEADER BAR */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-1 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-display font-black text-sm text-white">
            Flash Sale Promos
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin"></div>
          <p className="text-xs text-neutral-400 font-bold mt-3">Kutsitsa amakuponi otentha...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* SALES HERO BAR */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 mx-4 mt-4 rounded-3xl shadow-xl border border-blue-500/20">
            {/* Background elements */}
            <div className="absolute top-[-20px] right-[-20px] text-8xl opacity-10 select-none animate-pulse">
              🎟️
            </div>

            <div className="flex flex-col gap-1.5 relative z-10">
              <span className="inline-flex self-start items-center gap-1 bg-[#E42525] text-white tracking-widest uppercase font-display font-black text-[9px] px-2.5 py-1 rounded-full border border-red-400/30">
                <Flame className="h-3 w-3 fill-white stroke-none" />
                Live Event
              </span>
              <h1 className="text-xl font-display font-black text-white tracking-tight mt-1.5 leading-none">
                🔥 {saleSettings.saleName} Coupons
              </h1>
              <p className="text-xs text-blue-100 font-semibold max-w-xs leading-relaxed mt-1">
                Collect before they run out! Only one claim verified per individual wallet.
              </p>

              {/* Countdown panel */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-blue-400/20">
                <Clock className="h-4.5 w-4.5 text-blue-200" />
                <span className="text-[10px] uppercase font-display font-black text-blue-200 tracking-wider">
                  Ends In:
                </span>
                <span className="font-mono text-sm font-black bg-neutral-900/40 px-3 py-1 rounded-lg border border-white/5 tracking-wider text-[#FFB300]">
                  {timeLeftString}
                </span>
              </div>
            </div>
          </div>

          {/* MAIN GRID */}
          <div className="px-4 flex flex-col gap-4">
            <h3 className="font-display font-black text-xs text-neutral-400 uppercase tracking-widest">
              Available flash claims
            </h3>

            {saleCoupons.length === 0 ? (
              <div className="text-center py-16 px-4 bg-neutral-850 rounded-3xl border border-neutral-800 flex flex-col items-center justify-center">
                <AlertCircle className="h-10 w-10 text-neutral-600 mb-2" />
                <p className="text-xs text-neutral-400 font-bold">No active promotional coupons panopa.</p>
                <p className="text-[10px] text-neutral-500 mt-1">Check back later when a new event commences!</p>
              </div>
            ) : (
              /* GRID LAYOUT FOR SALE ITEMS */
              <div className="grid grid-cols-1 gap-3.5">
                {saleCoupons.map((coupon) => {
                  const codeUpper = (coupon.code || coupon.id || '').toUpperCase();
                  const isCollected = userCollectedCodes.includes(codeUpper);
                  const isBusy = collectingCode === codeUpper;
                  const isFull = coupon.usedCount !== undefined && coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses;

                  return (
                    <div 
                      key={coupon.id}
                      className={`rounded-2xl border overflow-hidden flex shadow-md relative transition-all ${
                        isCollected
                          ? 'border-emerald-600/30 bg-emerald-950/10'
                          : 'border-neutral-800 bg-neutral-850'
                      }`}
                    >
                      {/* Left vertical visual strip */}
                      <div 
                        className={`w-3.5 shrink-0 ${
                          isCollected 
                            ? 'bg-emerald-500' 
                            : (isFull ? 'bg-neutral-600' : 'bg-blue-600')
                        }`}
                      ></div>

                      {/* Content panel */}
                      <div className="flex-1 p-4 flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-display font-black text-sm text-white tracking-tight">
                            MWK {coupon.discountAmount ? coupon.discountAmount.toLocaleString() : '0'} OFF
                          </h4>
                          <p className="text-[10px] text-neutral-400 font-bold mt-0.5">
                            For orders over MWK {coupon.minOrderValue ? coupon.minOrderValue.toLocaleString() : '0'}
                          </p>

                          {/* Supply indicator tracking */}
                          <div className="flex items-center gap-1.5 mt-2.5">
                            <span className="text-[9px] text-neutral-500 font-semibold uppercase tracking-wider">
                              Claims:
                            </span>
                            <div className="h-1.5 w-16 bg-neutral-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${isCollected ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                style={{ width: `${Math.min(100, ((coupon.usedCount || 0) / (coupon.maxUses || 100)) * 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-[9px] text-neutral-400 font-mono font-bold">
                              {coupon.usedCount || 0}/{coupon.maxUses || 100}
                            </span>
                          </div>

                          <div className="mt-2.5 flex items-center gap-1.5">
                            <span className="text-[8px] font-bold text-neutral-400 uppercase">Code:</span>
                            <span className="text-[9px] font-mono font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                              {codeUpper}
                            </span>
                          </div>
                        </div>

                        {/* Gather Action Side */}
                        <div className="pl-3.5 border-l border-neutral-800">
                          {isCollected ? (
                            <span className="inline-flex items-center gap-1 font-display font-black text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-full">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Collected</span>
                            </span>
                          ) : isFull ? (
                            <span className="inline-flex items-center gap-1 font-display font-black text-xs text-neutral-500 bg-neutral-800 px-3 py-2 rounded-full">
                              All taken
                            </span>
                          ) : (
                            <button
                              disabled={isBusy}
                              onClick={() => handleCollectCoupon(coupon)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-display font-black text-xs rounded-full transition-all tracking-wide shadow-sm uppercase shrink-0 disabled:opacity-50"
                            >
                              {isBusy ? 'Saving...' : 'Collect'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* VIEW COLLECTED COUPONS ACTION */}
          <div className="mt-6 px-4 flex flex-col items-center">
            <button
              onClick={() => navigate('/account/coupons')}
              className="w-full text-center py-3 border border-neutral-800 hover:bg-neutral-850 text-neutral-300 font-display font-black text-xs rounded-full uppercase tracking-wider transition-all"
            >
              View My Coupons
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
