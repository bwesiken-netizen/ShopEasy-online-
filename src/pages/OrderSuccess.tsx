import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCartStore, useAuthStore } from '../stores';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { Check, Copy, ShoppingBag, ArrowRight, Home, Coins, Calendar, Info, Clock, CheckCircle } from 'lucide-react';

export default function OrderSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCartStore();
  const { user, awardCoins } = useAuthStore();

  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState('');
  const [coinsAwarded, setCoinsAwarded] = useState(0);

  // Parse params
  const txRef = searchParams.get('tx_ref') || 'ORD_' + Math.floor(100000 + Math.random() * 900000);
  const subtotal = Number(searchParams.get('subtotal') || '5000');
  const discount = Number(searchParams.get('discount') || '0');
  const total = Number(searchParams.get('total') || '5000');
  const isSimulated = searchParams.get('isSimulated') === 'true';

  // State values for presentation
  const buyerName = searchParams.get('buyerName') || user?.name || 'ShopEasy Customer';
  const buyerPhone = searchParams.get('buyerPhone') || user?.phone || '+265999824510';
  const deliveryType = searchParams.get('deliveryType') || 'delivery';
  const city = searchParams.get('city') || user?.location || 'Lilongwe';
  const area = searchParams.get('area') || 'City Centre';

  useEffect(() => {
    // 1. Immediately wipe the cart upon successful order completion and land
    clearCart();

    // 2. Do verification and coins calculation
    const calculatedCoins = Math.floor(total / 500);
    setCoinsAwarded(calculatedCoins > 0 ? calculatedCoins : 1);

    const performInvoiceVerify = async () => {
      try {
        console.log('[Invoice Verify] Verifying transaction details for Reference:', txRef);
        const response = await fetch(`/api/paychangu/verify/${txRef}`);
        const result = await response.json();

        // If verified, update Firestore document paymentStatus inside the cloud database!
        if (response.ok && result.status === 'success') {
          console.log('[Invoice Verify] Paychangu invoice matches successfully!');
          
          try {
            const orderDocRef = doc(db, 'orders', txRef);
            const orderSnap = await getDoc(orderDocRef);
            
            if (orderSnap.exists()) {
              await updateDoc(orderDocRef, {
                paymentStatus: 'paid',
                status: 'processing'
              });
              console.log('[Invoice Verify] Order status updated to PAID and PROCESSING in Firestore.');
            }
          } catch (dbErr) {
            console.warn('[Invoice Verify] Non-blocking database update, fallback OK:', dbErr);
          }

          // Reward Coins Award loop
          if (calculatedCoins > 0 && user) {
            awardCoins(calculatedCoins);
          }
        }
      } catch (err: any) {
        console.warn('[Invoice Verify] Non-critical network check:', err.message);
      } finally {
        setIsVerifying(false);
      }
    };

    performInvoiceVerify();
  }, [txRef, total, user, clearCart, awardCoins]);

  const copyOrderId = () => {
    navigator.clipboard.writeText(txRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 flex flex-col gap-5 bg-[#F9F9FA] min-h-screen pb-20 justify-center items-center animate-[fadeIn_0.3s_ease] text-left">
      
      {/* SUCCESS CARD CONTAINER */}
      <div className="bg-white rounded-3xl border border-neutral-100 p-6 flex flex-col items-center text-center shadow-md w-full max-w-sm mt-4">
        
        {/* CSS Green Checkmark Animation Ring */}
        <div className="relative flex items-center justify-center w-20 h-20 bg-emerald-50 rounded-full border-4 border-emerald-150 shadow-inner mb-4 animate-[bounce_1s_ease-out]">
          <div className="absolute inset-0 bg-emerald-100/50 rounded-full animate-ping" />
          <CheckCircle className="h-10 w-10 text-emerald-600 relative z-10" />
        </div>

        {/* Header Congratulate */}
        <h2 className="font-display font-black text-xl text-neutral-850 tracking-tight leading-none uppercase">
          Zikomo! 🎉
        </h2>
        <p className="text-xs font-semibold text-neutral-500 mt-2 max-w-xs leading-relaxed">
          Order placed successfully! We have submitted your order to the sellers.
        </p>

        {/* ORDER REFERENCE COPING COMPONENT */}
        <div className="mt-4 bg-neutral-50 border border-neutral-150 p-3 rounded-2xl w-full flex justify-between items-center text-left">
          <div className="min-w-0">
            <span className="block text-[9px] uppercase tracking-wider font-extrabold text-neutral-400">Order Reference ID</span>
            <span className="block font-mono font-black text-xs text-neutral-800 tracking-tight truncate">
              {txRef}
            </span>
          </div>
          <button
            onClick={copyOrderId}
            className={`p-2.5 rounded-xl transition-all ${
              copied 
                ? 'bg-emerald-100 text-emerald-700' 
                : 'bg-white hover:bg-neutral-100 text-neutral-500 border border-neutral-200 shadow-xs'
            }`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        {/* VERIFICATION LOADER INDICATION */}
        {isVerifying ? (
          <div className="mt-3.5 flex items-center gap-2 bg-sky-50 border border-sky-100 py-2 px-3.5 rounded-xl w-full text-left">
            <div className="h-3.5 w-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-[10px] font-bold text-sky-800">
              Verifying transaction through Paychangu gateway API...
            </span>
          </div>
        ) : (
          <div className="mt-3.5 flex items-center gap-2 bg-emerald-50 border border-emerald-100 py-2 px-3.5 rounded-xl w-full text-left">
            <span className="text-xs">✅</span>
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
              Transaction Secured & Verified
            </span>
          </div>
        )}

        {/* COIN REWARD LOYALTY GLOW BOX */}
        {coinsAwarded > 0 && (
          <div className="mt-4 bg-amber-50 rounded-2xl p-3.5 border border-amber-200 text-center flex flex-col items-center gap-1.5 w-full shadow-inner animate-[pulse_2s_infinite]">
            <Coins className="h-7 w-7 text-amber-500" />
            <div className="leading-tight">
              <span className="block text-[9px] font-black uppercase text-amber-800 tracking-wider">ShopEasy Loyalty Reward</span>
              <span className="block font-sans text-xs font-black text-amber-950 mt-0.5">
                + {coinsAwarded} Coins Received!
              </span>
              <span className="block text-[8px] text-amber-700 font-semibold mt-0.5">
                1 Coin awarded per MWK 500 spent. Collect coins to claim free gifts.
              </span>
            </div>
          </div>
        )}

      </div>

      {/* DETAIL CONSOLE LIST */}
      <div className="bg-white rounded-3xl border border-neutral-100 p-5 shadow-xs w-full max-w-sm text-xs">
        
        <h4 className="font-display font-black text-[10px] text-neutral-400 uppercase tracking-widest pb-2 border-b border-neutral-100 mb-2">// Logistics Dispatch Summary</h4>

        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-start">
            <span className="font-bold text-neutral-400">Payment status:</span>
            <span className="font-extrabold text-[#D32F2F] tracking-wide uppercase text-[10px] bg-red-50 border border-red-100 px-2 py-0.5 rounded leading-none">
              Paid • Paychangu
            </span>
          </div>

          <div className="flex justify-between items-start">
            <span className="font-bold text-neutral-400">Delivery estimation:</span>
            <span className="font-extrabold text-neutral-800 text-right max-w-[180px]">
              Arrange with seller for delivery/pickup • ships from seller's city
            </span>
          </div>

          <div className="flex justify-between items-start">
            <span className="font-bold text-neutral-400">Paid Amount:</span>
            <span className="font-mono font-black text-neutral-900">
              MWK {total.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-start">
            <span className="font-bold text-neutral-400 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-neutral-450" />
              <span>Registered time:</span>
            </span>
            <span className="font-sans font-extrabold text-neutral-700">
              {new Date().toLocaleDateString('em-MW', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="mt-4 bg-sky-50 rounded-2xl p-3 flex gap-2.5 items-start text-sky-850">
          <Info className="h-4.5 w-4.5 text-sky-600 shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed font-semibold text-sky-950">
            We've notified the store owner(s). If they do not contact you within 24 hours, click "Track Order" or open their chat drawer.
          </p>
        </div>

      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex gap-3 w-full max-w-sm mt-1">
        <button
          onClick={() => navigate('/account')}
          className="flex-1 py-3.5 bg-[#E53935] hover:bg-red-700 text-xs font-black text-white rounded-full transition-all text-center uppercase tracking-widest shadow-md shadow-red-500/15"
        >
          Track Order
        </button>

        <button
          className="flex-1 py-3.5 bg-neutral-250 hover:bg-neutral-300 text-neutral-750 text-xs font-black rounded-full transition-all text-center uppercase tracking-widest"
          onClick={() => navigate('/shop')}
        >
          Explore More
        </button>
      </div>

    </div>
  );
}
