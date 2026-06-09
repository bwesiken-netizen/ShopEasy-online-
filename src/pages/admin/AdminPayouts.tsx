import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuthStore } from '../../stores';
import { 
  Search, 
  Download, 
  CheckCircle, 
  X, 
  Phone, 
  AlertCircle, 
  Smartphone, 
  CreditCard,
  DollarSign,
  RefreshCw 
} from 'lucide-react';

export default function AdminPayouts() {
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');

  // Modal / Confirm States
  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);
  const [isPayConfirmOpen, setIsPayConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'payouts'));
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });

      // Sort payouts descending by requested date
      list.sort((a, b) => {
        const da = a.requestedAt?.seconds ? a.requestedAt.seconds * 1000 : new Date(a.requestedAt || 0).getTime();
        const dbTime = b.requestedAt?.seconds ? b.requestedAt.seconds * 1000 : new Date(b.requestedAt || 0).getTime();
        return dbTime - da;
      });

      setPayouts(list);
    } catch (err) {
      console.error("Error loaded payouts: ", err);
      showToast("Could not retrieve withdrawal listings.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleReleasePayout = async () => {
    if (!selectedPayout) return;

    setProcessing(true);
    try {
      const payoutRef = doc(db, 'payouts', selectedPayout.id);

      // 1. Update status to 'paid' with stamp of admin details & date
      await updateDoc(payoutRef, {
        status: 'paid',
        paidAt: new Date().toISOString(),
        paidBy: currentUser?.uid || 'administrator',
        paidByName: currentUser?.name || 'Admin Agent'
      });

      // 2. Alert merchant of transfer success
      await addDoc(collection(db, 'notifications'), {
        userId: selectedPayout.sellerId || selectedPayout.storeId,
        title: '💸 Withdrawal Disbursed! 💸',
        body: `Your payout request of MWK ${(selectedPayout.amount || 0).toLocaleString()} has been released to your ${selectedPayout.mobileMoneyProvider} wallet. Check account!`,
        type: 'coin',
        read: false,
        createdAt: new Date().toISOString()
      });

      // 3. Write action to adminLogs collection
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: 'RELEASE_PAYOUT',
        targetId: selectedPayout.id,
        targetName: `Payout to Merchant #${selectedPayout.sellerId}`,
        reason: `Disbursed and processed MWK ${selectedPayout.amount} via ${selectedPayout.mobileMoneyProvider}`,
        createdAt: serverTimestamp()
      });

      showToast(`Payout withdrawal of MWK ${selectedPayout.amount.toLocaleString()} marked paid!`, "success");
      setIsPayConfirmOpen(false);
      setSelectedPayout(null);
      fetchPayouts();
    } catch (err) {
      console.error(err);
      showToast("Transfer release failed at security rules.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = "Payout ID,Seller ID,Amount (MWK),Provider,Payout Wallet,Status,Requested At,Disbursed At,Admin Agent\n";
      const rows = payouts.map(p => {
        const requestedDate = p.requestedAt?.seconds 
          ? new Date(p.requestedAt.seconds * 1000).toISOString() 
          : new Date(p.requestedAt || 0).toISOString();
        const disbursedDate = p.paidAt ? new Date(p.paidAt).toISOString() : 'pending';
        return `"${p.id}","${p.sellerId || p.storeId}","${p.amount}","${p.mobileMoneyProvider}","${p.mobileMoneyNumber}","${p.status}","${requestedDate}","${disbursedDate}","${p.paidByName || p.paidBy || 'none'}"`;
      }).join("\n");

      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `ShopEasy_Payout_Database_Export_${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("CSV ledger successfully exported!", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed.", "error");
    }
  };

  // Tab Filtering and keyword search
  const filteredPayouts = payouts.filter((p) => {
    const rawSearch = searchQuery.toLowerCase();
    const matchesQuery = 
      (p.mobileMoneyNumber || '').includes(rawSearch) ||
      (p.mobileMoneyProvider || '').toLowerCase().includes(rawSearch) ||
      (p.sellerId || p.id || '').toLowerCase().includes(rawSearch);

    if (!matchesQuery) return false;

    // Tab Filters
    if (activeTab === 'pending') return p.status === 'pending';
    if (activeTab === 'completed') return p.status === 'paid' || p.status === 'completed';
    return true; // all
  });

  return (
    <div className="space-y-6" id="admin-payouts-root">
      
      {/* HUD Header Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-3xs flex justify-between items-center flex-wrap gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Withdrawal Ledger Terminal</h2>
          <p className="text-[10px] text-slate-450 font-bold uppercase">Disburse mobile money payout clearances and download regulatory CSV tables</p>
        </div>

        <div className="flex gap-2.5 flex-wrap w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <input
              type="text"
              placeholder="Search by wallet phone, merchant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-202 border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-rose-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <button
            onClick={handleExportCSV}
            className="p-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-705 text-slate-700 text-xs font-black uppercase rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-200 shadow-3xs cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download CSV
          </button>
        </div>
      </div>

      {toast && (
        <div className={`p-3 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-xl text-xs font-bold`}>
           {toast.message}
        </div>
      )}

      {/* Tabs list */}
      <div className="flex border-b border-slate-100 bg-white p-1 rounded-xl border max-w-sm">
        {(['all', 'pending', 'completed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[10px] font-black uppercase text-center rounded-lg transition duration-200 ${
              activeTab === tab
                ? 'bg-rose-600 text-white shadow-3xs'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab} {tab === 'pending' && payouts.filter(p => p.status === 'pending').length > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-800 text-[8.5px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                {payouts.filter(p => p.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid List view */}
      {loading ? (
        <div className="text-center py-20 text-slate-500 font-bold text-xs">
          Interregating payout balances system database...
        </div>
      ) : filteredPayouts.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-400 font-bold text-xs border rounded-2.5xl">
          No matches found under filter selection "{activeTab}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="payouts-card-grid">
          {filteredPayouts.map((item) => {
            const isPending = item.status === 'pending';
            const reqDateObj = item.requestedAt?.seconds 
              ? new Date(item.requestedAt.seconds * 1000) 
              : new Date(item.requestedAt || 0);

            return (
              <div 
                key={item.id} 
                className={`bg-white rounded-2.5xl p-4.5 border flex flex-col justify-between space-y-4 shadow-3xs transition hover:shadow-2xs ${
                  isPending ? 'border-amber-150 bg-amber-50/5' : 'border-slate-100'
                }`}
              >
                <div className="space-y-3.5">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                      <CreditCard className="w-4.5 h-4.5" />
                    </div>
                    
                    <span className={`text-[8.5px] font-black uppercase px-2.5 py-0.5 border rounded-full ${
                      isPending 
                        ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse' 
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {item.status || 'pending'}
                    </span>
                  </div>

                  <div>
                     <span className="text-[10px] uppercase font-black tracking-wide text-slate-450 block">Withdrawal Request Amount</span>
                     <span className="font-mono text-base font-black text-slate-900 mt-1 block">MWK {item.amount?.toLocaleString()}</span>
                  </div>

                  {/* Wallet Recipient Info */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl text-[11px] font-medium leading-relaxed font-sans space-y-1">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Smartphone className="w-3.5 h-3.5 text-slate-400 font-black" />
                      <span>Provider: <strong className="text-slate-950">{item.mobileMoneyProvider || 'Airtel Money'}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>Wallet Phone: <strong className="text-slate-950 font-mono">{item.mobileMoneyNumber}</strong></span>
                    </div>
                    <div className="text-[9.5px] text-slate-400 font-mono block select-all">
                       Merchant UID: #{item.sellerId || item.storeId}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-xs gap-3">
                  <span className="text-[10px] text-slate-400 font-semibold font-mono flex items-center gap-1.5">
                     Req: {reqDateObj.toLocaleDateString()}
                  </span>

                  {isPending ? (
                    <button
                      onClick={() => { setSelectedPayout(item); setIsPayConfirmOpen(true); }}
                      className="p-1.5 px-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9.5px] font-black uppercase transition-all shadow-3xs flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Disburse Cash
                    </button>
                  ) : (
                    <span className="text-[9.5px] text-emerald-800 font-black flex items-center gap-1">
                       Released by: {item.paidByName || 'Admin'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payout Confirmation modal */}
      {isPayConfirmOpen && selectedPayout && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease]">
          <div className="bg-white rounded-3xl p-5.5 w-full max-w-md relative border shadow-2xl space-y-4">
             <div className="flex items-center gap-2 text-rose-650">
                <DollarSign className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-black uppercase text-slate-900">Authorize Transfer Release</h3>
             </div>

             <div className="p-3.5 bg-slate-50 rounded-2xl text-xs space-y-2 leading-relaxed text-slate-600 font-medium">
                <p>Ensure manual transfer on Airtel / Mpamba portal is completed FIRST:</p>
                <div className="bg-white p-2.5 border rounded-xl font-bold font-mono text-slate-900 space-y-1">
                   <div>Amt: MWK {selectedPayout.amount?.toLocaleString()}</div>
                   <div>Wallet: {selectedPayout.mobileMoneyNumber}</div>
                   <div>Provider: {selectedPayout.mobileMoneyProvider}</div>
                </div>
             </div>

             <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                Confirming this releases the escrow payout record instantly, alerts the merchant on their dashboard, and logs audit credentials.
             </p>

             <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => { setIsPayConfirmOpen(false); setSelectedPayout(null); }}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition"
                >
                  Cancel Release
                </button>
                <button
                  onClick={handleReleasePayout}
                  disabled={processing}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase transition-all shadow-3xs"
                >
                  {processing ? 'Processing...' : 'Mark Disbursed'}
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
