import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  getDoc 
} from 'firebase/firestore';
import { useAuthStore } from '../../stores';
import { 
  Building2, 
  Mail, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Eye, 
  X, 
  Search, 
  Clock, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';

export default function AdminSellers() {
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [pendingStores, setPendingStores] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // ID Modal States
  const [selectedStore, setSelectedStore] = useState<any | null>(null);
  const [isIdModalOpen, setIsIdModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Listen to real-time stores in "pending_approval" status
    const pendingQuery = query(
      collection(db, 'stores'),
      where('status', '==', 'pending_approval')
    );

    const unsubscribe = onSnapshot(pendingQuery, (snapshot) => {
      const stores: any[] = [];
      snapshot.forEach((d) => {
        stores.push({ id: d.id, ...d.data() });
      });
      setPendingStores(stores);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to pending merchant request queue: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleApproveStore = async (store: any) => {
    setProcessing(true);
    try {
      const storeRef = doc(db, 'stores', store.id);
      const userRef = doc(db, 'users', store.sellerId);

      // 1. Approve store
      await updateDoc(storeRef, {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        rejectionReason: null
      });

      // 2. Elevate owner to seller role
      await updateDoc(userRef, {
        role: 'seller'
      });

      // 3. Send real merchant dashboard notification
      await addDoc(collection(db, 'notifications'), {
        userId: store.sellerId,
        title: '🌟 Shop Approved! 🏪',
        body: `Congratulations, "${store.name}" has been approved! You can now start uploading your products and receiving payments.`,
        type: 'promo',
        read: false,
        createdAt: new Date().toISOString()
      });

      // 4. Audit Log
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: 'APPROVE_STORE',
        targetId: store.id,
        targetName: store.name,
        reason: 'Passed verification: National ID and Contact validation satisfied.',
        createdAt: serverTimestamp()
      });

      showToast(`Merchant Store ${store.name} successfully verified!`, 'success');
      setSelectedStore(null);
      setIsIdModalOpen(false);
    } catch (err) {
      console.error("Approval flow failed:", err);
      showToast("Store approval rejected by database rules.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectStore = async () => {
    if (!selectedStore) return;
    if (!rejectReason.trim()) {
      showToast("Justification is absolutely mandatory.", "error");
      return;
    }

    setProcessing(true);
    try {
      const storeRef = doc(db, 'stores', selectedStore.id);

      // 1. Reject store status
      await updateDoc(storeRef, {
        status: 'rejected',
        rejectionReason: rejectReason,
        rejectedAt: new Date().toISOString()
      });

      // 2. Alert the merchant
      await addDoc(collection(db, 'notifications'), {
        userId: selectedStore.sellerId,
        title: '⚠️ Store Application Rejected',
        body: `Your store application for "${selectedStore.name}" was declined. Reason: ${rejectReason}`,
        type: 'order',
        read: false,
        createdAt: new Date().toISOString()
      });

      // 3. Log reject
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: 'REJECT_STORE',
        targetId: selectedStore.id,
        targetName: selectedStore.name,
        reason: rejectReason,
        createdAt: serverTimestamp()
      });

      showToast(`Store ${selectedStore.name} application declined.`, "success");
      setIsRejectModalOpen(false);
      setRejectReason('');
      setSelectedStore(null);
      setIsIdModalOpen(false);
    } catch (err) {
      console.error("Rejection action failed:", err);
      showToast("Rejection could not be persisted.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const filteredStores = pendingStores.filter((st) => {
    const queryTerm = searchQuery.toLowerCase();
    return (
      (st.name || '').toLowerCase().includes(queryTerm) ||
      (st.city || '').toLowerCase().includes(queryTerm) ||
      (st.id || '').toLowerCase().includes(queryTerm)
    );
  });

  return (
    <div className="space-y-6" id="admin-sellers-approvals-root">
      
      {/* HUD Header Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-3xs flex justify-between items-center flex-wrap gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Seller Registration Desk</h2>
          <p className="text-[10px] text-slate-450 font-bold uppercase">Verify national credentials and approve merchant storefront entries</p>
        </div>

        <div className="relative w-full max-w-xs">
          <input
            type="text"
            placeholder="Search stores by name, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {toast && (
        <div className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <AlertCircle className="w-4 h-4" />
          <span>{toast.message}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-slate-500 font-bold text-xs">
          Connecting to pending merchant pipeline logs...
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="bg-white p-12 rounded-2.5xl border border-dashed border-slate-200 text-center text-slate-400 font-bold text-xs">
          ✨ There are no pending seller applications awaiting verification. Good job!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="store-onboarding-grid">
          {filteredStores.map((st) => (
            <div 
              key={st.id} 
              className="bg-white rounded-2.5xl p-4.5 border border-slate-100 shadow-3xs flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="w-11 h-11 bg-slate-50 border rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                      {st.logo ? (
                        <img referrerPolicy="no-referrer" src={st.logo} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-tight">{st.name}</h4>
                      <span className="text-[10px] text-slate-400 uppercase font-black tracking-wide mr-2">{st.category}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">{st.city}</span>
                    </div>
                  </div>
                  <span className="text-[9.5px] font-black uppercase text-amber-600 bg-amber-50 px-2.5 py-0.5 border border-amber-150 rounded-full flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 animate-spin" /> Pending
                  </span>
                </div>

                <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 text-[11px] font-medium text-slate-650">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Phone: {st.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">WhatsApp: {st.whatsapp || 'None'}</span>
                  </div>
                  {st.airtelMoney && (
                    <div className="text-[9.5px] text-emerald-800 font-bold">
                       Airtel Money: {st.airtelMoney}
                    </div>
                  )}
                  {st.tnmMpamba && (
                    <div className="text-[9.5px] text-blue-800 font-bold">
                       TNM Mpamba: {st.tnmMpamba}
                    </div>
                  )}
                </div>

                {st.description && (
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold line-clamp-2">
                    "{st.description}"
                  </p>
                )}
              </div>

              <div className="pt-3.5 border-t border-slate-50 flex items-center justify-between gap-2">
                <button
                  onClick={() => { setSelectedStore(st); setIsIdModalOpen(true); }}
                  className="p-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] uppercase rounded-xl transition flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> Credentials ID
                </button>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setSelectedStore(st); setIsRejectModalOpen(true); }}
                    className="p-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-[10.5px] uppercase rounded-xl transition flex items-center gap-1 border border-rose-100"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={() => handleApproveStore(st)}
                    disabled={processing}
                    className="p-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10.5px] uppercase rounded-xl transition flex items-center gap-1 shadow-3xs"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ID credential viewer modal */}
      {isIdModalOpen && selectedStore && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease]">
          <div className="bg-white rounded-3xl p-5.5 w-full max-w-2xl relative border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => { setIsIdModalOpen(false); setSelectedStore(null); }}
              className="p-1.5 bg-slate-50 text-slate-400 hover:text-slate-800 rounded-full absolute right-4 top-4"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="space-y-0.5">
              <h3 className="text-sm font-black text-slate-900 uppercase">National Identification Credentials</h3>
              <p className="text-[10px] text-slate-400 uppercase font-black">{selectedStore.name} — Regulatory Check</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-450 uppercase block">1. Front ID Card</span>
                <div className="aspect-[1.6/1] bg-slate-50 border rounded-2xl overflow-hidden flex items-center justify-center relative shadow-3xs">
                  {selectedStore.idFront ? (
                    <img referrerPolicy="no-referrer" src={selectedStore.idFront} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-slate-400 text-xs font-bold">No Front ID Uploaded</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-450 uppercase block">2. Back ID Card</span>
                <div className="aspect-[1.6/1] bg-slate-50 border rounded-2xl overflow-hidden flex items-center justify-center relative shadow-3xs">
                  {selectedStore.idBack ? (
                    <img referrerPolicy="no-referrer" src={selectedStore.idBack} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-slate-400 text-xs font-bold">No Back ID Uploaded</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3 border-t border-slate-100">
              <button
                onClick={() => { setIsIdModalOpen(false); setIsRejectModalOpen(true); }}
                className="flex-1 py-3 border border-rose-150 text-rose-750 font-black text-xs uppercase hover:bg-rose-50 rounded-xl transition"
              >
                Reject Card Application
              </button>
              <button
                onClick={() => handleApproveStore(selectedStore)}
                disabled={processing}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-705 text-white font-black text-xs uppercase rounded-xl transition shadow-3xs"
              >
                Approve & Activate Merchant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection justification modal */}
      {isRejectModalOpen && selectedStore && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-55 animate-[fadeIn_0.2s_ease]">
          <div className="bg-white rounded-3xl p-5.5 w-full max-w-md relative border shadow-2xl space-y-4">
            <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2 text-rose-650">
              <XCircle className="w-5 h-5 shrink-0" /> Decline Application
            </h3>

            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Why are you rejecting <strong className="text-slate-900">"{selectedStore.name}"</strong>? This message will show directly on their merchant onboarding dashboard.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-450 uppercase">Mandatory Reject Reason</label>
              <textarea
                rows={3}
                placeholder="Specify precise issue (e.g., ID image blurry, passport of different person)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => { setIsRejectModalOpen(false); setRejectReason(''); }}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectStore}
                disabled={processing || !rejectReason.trim()}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white disabled:bg-slate-200 disabled:text-slate-400 rounded-xl text-xs font-black uppercase transition"
              >
                {processing ? 'Processing...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
