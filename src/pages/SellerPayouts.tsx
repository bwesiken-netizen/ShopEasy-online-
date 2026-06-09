import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  ArrowLeft, 
  Wallet, 
  CreditCard, 
  ArrowUpRight, 
  History, 
  Settings, 
  Send, 
  Smartphone, 
  HelpCircle, 
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

export default function SellerPayouts() {
  const uid = auth.currentUser?.uid;

  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Financial Metrics
  const [totalCompletedSales, setTotalCompletedSales] = useState(0);
  const [totalApprovedPayouts, setTotalApprovedPayouts] = useState(0);
  const [totalPendingPayouts, setTotalPendingPayouts] = useState(0);

  // Payout request variables
  const [payoutAmount, setPayoutAmount] = useState<number | ''>('');
  const [selectedProvider, setSelectedProvider] = useState<'Airtel' | 'Mpamba'>('Airtel');
  const [customWalletNum, setCustomWalletNum] = useState('');

  // Tables list
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);

  // Page layout states
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!uid) return;
    fetchFinancialData();
  }, [uid]);

  const fetchFinancialData = async () => {
    setLoading(true);
    setValidationError('');
    try {
      // 1. Fetch Store details to default mobile wallets
      const storeDoc = await getDoc(doc(db, 'stores', uid));
      if (storeDoc.exists()) {
        const sData = storeDoc.data();
        setStore(sData);
        
        // Auto-select based on what is available
        if (sData.airtelMoney) {
          setSelectedProvider('Airtel');
          setCustomWalletNum(sData.airtelMoney);
        } else if (sData.tnmMpamba) {
          setSelectedProvider('Mpamba');
          setCustomWalletNum(sData.tnmMpamba);
        }
      }

      // 2. Fetch Completed Orders
      const orderQuery = query(
        collection(db, 'orders'),
        where('storeId', '==', uid),
        where('status', '==', 'completed')
      );
      const oSnap = await getDocs(orderQuery);
      let salesSum = 0;
      oSnap.forEach((doc) => {
        const d = doc.data();
        salesSum += (d.total || 0);
      });
      setTotalCompletedSales(salesSum);

      // 3. Fetch Payout Transactions History
      const payoutQuery = query(
        collection(db, 'payouts'),
        where('sellerId', '==', uid)
      );
      const pSnap = await getDocs(payoutQuery);
      const pList: any[] = [];
      let pendingSum = 0;
      let completedSum = 0;

      pSnap.forEach((doc) => {
        const d = doc.data();
        const pWithId = { id: doc.id, ...d };
        pList.push(pWithId);

        if (d.status === 'pending') {
          pendingSum += (d.amount || 0);
        } else if (d.status === 'completed' || d.status === 'approved') {
          completedSum += (d.amount || 0);
        }
      });

      // Sort history descending by requestedAt
      pList.sort((a, b) => {
        const dateA = a.requestedAt?.seconds ? a.requestedAt.seconds : new Date(a.requestedAt || 0).getTime() / 1000;
        const dateB = b.requestedAt?.seconds ? b.requestedAt.seconds : new Date(b.requestedAt || 0).getTime() / 1000;
        return dateB - dateA;
      });

      setPayoutHistory(pList);
      setTotalPendingPayouts(pendingSum);
      setTotalApprovedPayouts(completedSum);

    } catch (err) {
      console.error("Error loaded store balance sheet payout stats:", err);
    } finally {
      setLoading(false);
    }
  };

  // Available to Withdraw = Total Completed Sales minus Completed Payouts minus Pending Payouts
  const availableToWithdraw = Math.max(0, totalCompletedSales - totalApprovedPayouts - totalPendingPayouts);

  // Validate Malawi Phone Formatting (+265)
  const isValidMalawiPhone = (num: string) => {
    return /^\+265\d{8,10}$/.test(num.trim());
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (availableToWithdraw < 5000) {
      setValidationError('Your available balance is insufficient. Minimum withdrawal threshold is MWK 5,000.');
      return;
    }
    if (payoutAmount === '' || Number(payoutAmount) < 5000) {
      setValidationError('Please specify a withdrawal amount of at least MWK 5,000.');
      return;
    }
    if (Number(payoutAmount) > availableToWithdraw) {
      setValidationError(`Maximum amount you can withdraw is MWK ${availableToWithdraw.toLocaleString()}.`);
      return;
    }
    if (!customWalletNum.trim() || !isValidMalawiPhone(customWalletNum)) {
      setValidationError('A valid Malawi mobile money wallet recipient phone number in (+265...) format is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        sellerId: uid,
        storeId: uid,
        amount: Number(payoutAmount),
        mobileMoneyNumber: customWalletNum.trim(),
        mobileMoneyProvider: selectedProvider,
        status: 'pending',
        requestedAt: serverTimestamp()
      };

      // Create new payout draft in FireStore payouts matching request rules
      await addDoc(collection(db, 'payouts'), payload);

      // Create admin notification
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        title: '💵 New Payout Withdrawal Requested 💵',
        body: `Merchant "${store?.name || 'ShopEasy Seller'}" requested MWK ${Number(payoutAmount).toLocaleString()} payout to their ${selectedProvider} money wallet.`,
        type: 'order',
        read: false,
        createdAt: new Date().toISOString()
      });

      alert(`✓ Payout request of MWK ${Number(payoutAmount).toLocaleString()} submitted for admin processing! Balance was updated.`);
      
      // Update locally
      setPayoutAmount('');
      fetchFinancialData();
    } catch (err: any) {
      console.error("Payout request submission failure:", err);
      setValidationError('Failed to file payout order request: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectProvider = (prov: 'Airtel' | 'Mpamba') => {
    setSelectedProvider(prov);
    if (!store) return;
    if (prov === 'Airtel' && store.airtelMoney) {
      setCustomWalletNum(store.airtelMoney);
    } else if (prov === 'Mpamba' && store.tnmMpamba) {
      setCustomWalletNum(store.tnmMpamba);
    } else {
      setCustomWalletNum('');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500" id="payouts-loader">
        <div className="w-6 h-6 border-2 border-red-650 border-red-600 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-semibold">Tikalambula chuma chanu... Fetching finance balances...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4" id="seller-payouts-dashboard">
      
      {/* Balance Card: gold gradient */}
      <div className="bg-gradient-to-br from-amber-550 via-amber-500 to-yellow-600 text-white p-5 rounded-3xl border border-amber-400 shadow-md space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-1050 text-white/80">Available to Withdraw</span>
            <h2 className="text-2xl font-black tracking-tight font-mono text-white">
              MWK {availableToWithdraw.toLocaleString()}
            </h2>
            <span className="text-[10.5px] text-yellow-50 font-medium font-sans">
              Min withdrawal requirement: MWK 5,000 threshold
            </span>
          </div>

          <div className="p-3 bg-white/10 rounded-2xl">
            <Wallet className="w-6.5 h-6.5 text-white animate-pulse" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-3.5 text-xs text-white/90">
          <div>
            <span className="text-[9.5px] uppercase tracking-wider block opacity-75">Pending Transfer</span>
            <span className="font-mono font-bold text-[12.5px]">MWK {totalPendingPayouts.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[9.5px] uppercase tracking-wider block opacity-75">Total Profits Withdrawn</span>
            <span className="font-mono font-bold text-[12.5px]">MWK {totalApprovedPayouts.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Request Payout Form */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-3xs space-y-4">
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 flex-wrap justify-between">
          <span className="font-semibold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1">
            <ArrowUpRight className="w-4.5 h-4.5 text-emerald-500 animate-bounce" /> Request Wallet Withdrawal
          </span>
          <button 
            type="button" 
            onClick={fetchFinancialData} 
            className="text-[9.5px] font-bold text-indigo-600 flex items-center gap-0.5 hover:underline"
          >
            <RefreshCw className="w-3 h-3" /> Refresh Balance
          </button>
        </div>

        {validationError && (
          <div className="bg-rose-50 border border-rose-250 p-3 rounded-xl text-rose-850 font-bold text-xs">
            {validationError}
          </div>
        )}

        <form onSubmit={handlePayoutSubmit} className="space-y-3.5">
          
          {/* Amount field */}
          <div>
            <label className="block text-[10.5px] font-bold text-slate-500 uppercase mb-1">
              Payout Amount (MWK) *
            </label>
            <input 
              type="number"
              placeholder="E.g. 5000"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={availableToWithdraw < 5000}
              className="w-full text-xs font-mono font-bold px-3 py-2.5 border focus:outline-none rounded-xl bg-slate-50/50" 
            />
          </div>

          {/* Provider selectors */}
          <div>
            <label className="block text-[10.5px] font-bold text-slate-500 uppercase mb-1.5">
              Select Wallet Channel Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectProvider('Airtel')}
                className={`py-2 px-3 border rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  selectedProvider === 'Airtel' 
                    ? 'border-red-600 bg-red-50 text-red-800' 
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-4 h-4 text-red-500" /> Airtel Money
              </button>

              <button
                type="button"
                onClick={() => handleSelectProvider('Mpamba')}
                className={`py-2 px-3 border rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  selectedProvider === 'Mpamba' 
                    ? 'border-green-600 bg-green-50 text-green-800' 
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-4 h-4 text-green-500" /> TNM Mpamba
              </button>
            </div>
          </div>

          {/* Wallet Number field */}
          <div>
            <label className="block text-[10.5px] font-bold text-slate-500 uppercase mb-1">
              Recipient Wallet Phone Number *
            </label>
            <input 
              type="text"
              placeholder="+265XXXXXXXXX"
              value={customWalletNum}
              onChange={(e) => setCustomWalletNum(e.target.value)}
              className="w-full text-xs font-mono px-3 py-2.5 border focus:outline-none rounded-xl bg-slate-50/50" 
            />
            <span className="text-[9px] text-slate-400 mt-1 block">Formatted in international format (+265XXXXXXXXX)</span>
          </div>

          {/* Submit action */}
          <button
            type="submit"
            disabled={submitting || availableToWithdraw < 5000}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-3.5 rounded-xl transition uppercase tracking-wider flex items-center justify-center gap-1 shadow-3xs disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> {submitting ? 'Submitting request...' : 'Submit payout Request'}
          </button>

        </form>
      </div>

      {/* payout transaction list */}
      <div className="bg-white rounded-2xl p-4.5 border border-slate-100 shadow-3xs space-y-3">
        <h4 className="font-bold text-slate-850 text-xs uppercase font-mono tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <History className="w-4.5 h-4.5 text-slate-500" /> Payouts withdrawal History
        </h4>

        {payoutHistory.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs">
            No transfer requests filed yet. Once you submit a payout, it lists here.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 space-y-2.5">
            {payoutHistory.map((p) => {
              let requestDate = 'Just now';
              if (p.requestedAt) {
                const dateObj = p.requestedAt.seconds ? new Date(p.requestedAt.seconds * 1000) : new Date(p.requestedAt);
                requestDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              }

              const isCompleted = p.status === 'completed' || p.status === 'approved';
              const isPending = p.status === 'pending';
              const isRejected = p.status === 'rejected';

              return (
                <div key={p.id} className="flex justify-between items-center pt-2.5 text-xs">
                  <div className="space-y-1">
                    <h5 className="font-mono font-black text-slate-900">
                      MWK {p.amount?.toLocaleString()}
                    </h5>
                    <div className="text-[10px] text-slate-400 font-bold uppercase font-sans flex items-center gap-1.5 flex-wrap leading-normal">
                      <span>{p.mobileMoneyProvider} Wallet: {p.mobileMoneyNumber}</span>
                      <span>•</span>
                      <span>{requestDate}</span>
                    </div>
                  </div>

                  <span className={`text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isCompleted 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-150' 
                      : isPending 
                        ? 'bg-amber-50 text-amber-800 border-amber-100' 
                        : 'bg-rose-50 text-rose-850 border-rose-100'
                  }`}>
                    {p.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
