import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuthStore } from '../../stores';
import { 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Calendar, 
  HelpCircle, 
  MapPin, 
  Clock, 
  ShieldAlert, 
  ThumbsUp, 
  ThumbsDown 
} from 'lucide-react';

export default function AdminOrders() {
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  
  // Search / Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered' | 'completed' | 'disputed' | 'cancelled'>('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Detail Sheet States
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionJustification, setResolutionJustification] = useState('');
  const [resolutionSide, setResolutionSide] = useState<'buyer' | 'seller' | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'orders'));
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      // Sort orders descending by date
      list.sort((a,b) => {
        const da = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const dbTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return dbTime - da;
      });
      setOrders(list);
    } catch (err) {
      console.error("Error loaded orders: ", err);
      showToast("Could not retrieve system orders", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleResolveDispute = async () => {
    if (!selectedOrder || !resolutionSide) return;
    if (!resolutionJustification.trim()) {
      showToast("Please provide policy justification for transparency.", "error");
      return;
    }

    setSubmittingAction(true);
    try {
      const orderRef = doc(db, 'orders', selectedOrder.id);
      let targetStatus = '';
      let logAction = '';
      let buyerNotificationText = '';
      let sellerNotificationText = '';

      if (resolutionSide === 'buyer') {
        // Refunded to Buyer
        targetStatus = 'refunded';
        logAction = 'RESOLVE_DISPUTE_BUYER_FAVOR';
        buyerNotificationText = `🎉 Refund Approved: The dispute on your order #${selectedOrder.id.slice(0,7).toUpperCase()} has been resolved in your favor. Funds will be returned.`;
        sellerNotificationText = `⚠️ Dispute Closed: The dispute on order #${selectedOrder.id.slice(0,7).toUpperCase()} was ruled in favor of the Buyer. Refund will be processed.`;
      } else {
        // Side with Seller, release escrow to seller
        targetStatus = 'completed';
        logAction = 'RESOLVE_DISPUTE_SELLER_FAVOR';
        buyerNotificationText = `✉️ Dispute Ruled: The dispute on order #${selectedOrder.id.slice(0,7).toUpperCase()} has been parsed and completed in favor of the Merchant.`;
        sellerNotificationText = `🎉 Dispute Won: The dispute on order #${selectedOrder.id.slice(0,7).toUpperCase()} was ruled in your favor. Funds released successfully!`;

        // Update seller store profile total sales or earnings if they have it
        try {
          const storeRef = doc(db, 'stores', selectedOrder.storeId || selectedOrder.sellerId);
          const storeSnap = await getDoc(storeRef);
          if (storeSnap.exists()) {
             const currentSales = storeSnap.data().totalSales || 0;
             await updateDoc(storeRef, {
               totalSales: currentSales + Number(selectedOrder.total || 0)
             });
          }
        } catch (storeErr) {
          console.warn("Could not increment store stats:", storeErr);
        }
      }

      // 1. Update Order Status
      await updateDoc(orderRef, {
        status: targetStatus,
        disputeResolution: {
          side: resolutionSide,
          justification: resolutionJustification,
          resolvedAt: new Date().toISOString(),
          resolvedBy: currentUser?.uid || 'administrator'
        }
      });

      // 2. Add Notifications
      // For Buyer
      if (selectedOrder.buyerId) {
        await addDoc(collection(db, 'notifications'), {
          userId: selectedOrder.buyerId,
          title: '⚖️ Dispute Case Resolved ⚖️',
          body: buyerNotificationText,
          type: 'order',
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      // For Seller / Merchant
      const merchantId = selectedOrder.sellerId || selectedOrder.storeId;
      if (merchantId) {
        await addDoc(collection(db, 'notifications'), {
          userId: merchantId,
          title: '⚖️ Dispute Dispute Resolved ⚖️',
          body: sellerNotificationText,
          type: 'order',
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      // 3. Log Audit Logs
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentUser?.uid || 'unknown',
        adminName: currentUser?.name || 'Administrator',
        action: logAction,
        targetId: selectedOrder.id,
        targetName: `Order #${selectedOrder.id.slice(0,7)}`,
        reason: resolutionJustification,
        createdAt: serverTimestamp()
      });

      showToast(`Dispute resolved. Case closed in favor of the ${resolutionSide.toUpperCase()}.`, "success");
      setIsResolveModalOpen(false);
      setResolutionJustification('');
      setResolutionSide(null);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err) {
      console.error(err);
      showToast("Could not resolve dispute.", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const getOrderStatusBadgeColor = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    if (s.startsWith('dispute')) return 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse';
    if (s === 'completed' || s === 'delivered') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (s === 'cancelled' || s === 'refunded') return 'bg-rose-50 text-rose-800 border-rose-200';
    return 'bg-blue-50 text-blue-800 border-blue-250';
  };

  // Searching and filtering order payload logic
  const filteredOrders = orders.filter((o) => {
    const rawSearch = searchQuery.toLowerCase();
    const matchesKeyword = 
      (o.id || '').toLowerCase().includes(rawSearch) ||
      (o.buyerName || '').toLowerCase().includes(rawSearch) ||
      (o.storeName || o.sellerName || '').toLowerCase().includes(rawSearch) ||
      (o.city || '').toLowerCase().includes(rawSearch);

    if (!matchesKeyword) return false;

    // Status Filters
    const statusVal = (o.status || 'pending').toLowerCase();
    if (statusFilter !== 'all') {
      if (statusFilter === 'disputed') {
        if (!statusVal.startsWith('dispute') && !statusVal.includes('dispute')) return false;
      } else {
        if (statusVal !== statusFilter) return false;
      }
    }

    // City Filter
    if (cityFilter !== 'all') {
      if ((o.city || 'other').toLowerCase() !== cityFilter.toLowerCase()) return false;
    }

    // Date Filters
    if (dateFilter !== 'all') {
      let createdAtDate = new Date();
      if (o.createdAt) {
        if (o.createdAt.seconds) {
          createdAtDate = new Date(o.createdAt.seconds * 1000);
        } else {
          createdAtDate = new Date(o.createdAt);
        }
      } else {
        return false;
      }

      const diffTime = Date.now() - createdAtDate.getTime();
      const oneDay = 24 * 3600 * 1000;

      if (dateFilter === 'today' && diffTime > oneDay) return false;
      if (dateFilter === 'week' && diffTime > 7 * oneDay) return false;
      if (dateFilter === 'month' && diffTime > 30 * oneDay) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6" id="admin-orders-root">
      
      {/* HUD Header Bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-100 shadow-3xs flex justify-between items-center flex-wrap gap-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">Orders & Escrow Escort</h2>
          <p className="text-[10px] text-slate-450 font-bold uppercase">Inspect shipment dates, filter by territory and arbitrate open client disputes</p>
        </div>

        <div className="relative w-full max-w-xs">
          <input
            type="text"
            placeholder="Search by Order ID, Client, Shop..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {toast && (
        <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold">
          {toast.message}
        </div>
      )}

      {/* FILTER PANEL row */}
      <div className="bg-white p-4.5 rounded-2.5xl border border-slate-100 shadow-3xs grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        
        {/* Status selection */}
        <div className="space-y-1">
          <label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">Status Match</label>
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-205 rounded-xl text-xs font-bold text-slate-700 outline-hidden"
          >
            <option value="all">ALL TRANSACTION STATES</option>
            <option value="pending">PENDING CLEARANCE</option>
            <option value="delivered">DELIVERED CARGOS</option>
            <option value="completed">COMPLETED TRANSACTIONS</option>
            <option value="disputed">⚠️ ACTIVE DISPUTES</option>
            <option value="cancelled">CANCELLED CHECKS</option>
          </select>
        </div>

        {/* Territory match */}
        <div className="space-y-1">
          <label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">Territory Location</label>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-205 rounded-xl text-xs font-bold text-slate-700 outline-hidden"
          >
            <option value="all">ALL LOCAL DISTRICTS</option>
            <option value="Lilongwe">LILONGWE CENTRAL</option>
            <option value="Blantyre">BLANTYRE METRO</option>
            <option value="Zomba">ZOMBA CITY</option>
            <option value="Mzuzu">MZUZU NORTH</option>
          </select>
        </div>

        {/* Date match */}
        <div className="space-y-1">
          <label className="text-[9.5px] uppercase font-black text-slate-400 tracking-wider">Historical Timeframe</label>
          <select
            value={dateFilter}
            onChange={(e: any) => setDateFilter(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-205 rounded-xl text-xs font-bold text-slate-700 outline-hidden"
          >
            <option value="all">ALL HISTORIC LOGS</option>
            <option value="today">LAST 24 HOURS</option>
            <option value="week">LAST 7 DAYS</option>
            <option value="month">LAST 30 DAYS</option>
          </select>
        </div>

      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500 font-bold text-xs">
          Loading production order book snapshot...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white p-12 text-center text-slate-400 font-black text-xs border rounded-2.5xl">
          No records matching selected criteria found in system.
        </div>
      ) : (
        <div className="space-y-3.5" id="orders-list-terminal">
          {filteredOrders.map((ord) => {
            const hasDispute = (ord.status || '').toLowerCase().startsWith('dispute') || (ord.status || '').toLowerCase().includes('dispute');
            const totalItems = ord.items?.reduce((acc: number, item: any) => acc + (item.qty || item.quantity || 1), 0) || 1;

            return (
              <div
                key={ord.id}
                onClick={() => setSelectedOrder(ord)}
                className={`bg-white rounded-2.5xl p-4.5 border transition cursor-pointer hover:shadow-2xs flex flex-col md:flex-row justify-between md:items-center gap-4 ${
                  hasDispute 
                    ? 'border-amber-500 border-[3.5px] shadow-3xs shadow-amber-100 bg-amber-50/5' 
                    : 'border-slate-100'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className={`p-3 rounded-2xl shrink-0 ${hasDispute ? 'bg-amber-100 text-amber-900 animate-pulse' : 'bg-slate-50 text-slate-600'}`}>
                    {hasDispute ? <AlertTriangle className="w-5 h-5 text-amber-700 animate-bounce" /> : <Clock className="w-5 h-5 text-slate-450" />}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        #{ord.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">•</span>
                      <span className="text-[10px] text-slate-450 font-sans font-bold">
                        {ord.createdAt?.seconds ? new Date(ord.createdAt.seconds * 1000).toLocaleString() : new Date(ord.createdAt || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] font-bold text-slate-450 bg-slate-50 px-2 rounded flex items-center gap-0.5 ml-1">
                        <MapPin className="w-3 h-3 text-rose-500" /> {ord.city || 'Local'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-650 font-semibold truncate leading-tight">
                      Buyer: <strong className="text-slate-900">{ord.buyerName || 'ShopEasy Client'}</strong> ({ord.phone}) • Merchant: <strong className="text-slate-900">{ord.storeName || ord.sellerName || 'Local Merchant'}</strong>
                    </div>

                    <div className="text-[10.5px] text-slate-450 font-bold uppercase tracking-wide">
                      {totalItems} items ordered • Pay Mode: {ord.paymentMethod || 'Mobile Money Cash Delivery'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 border-t pt-3 md:pt-0 md:border-t-0 border-slate-50 whitespace-nowrap">
                  <div className="text-left md:text-right">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wide">Gross Total</span>
                    <span className="font-mono text-[13.5px] font-black text-slate-950">
                      MWK {(ord.total || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[9.5px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${getOrderStatusBadgeColor(ord.status)}`}>
                      {ord.status || 'pending'}
                    </span>
                    {hasDispute && (
                      <span className="text-[8.5px] bg-amber-600 text-white p-0.5 px-2 rounded-full font-black uppercase tracking-wide">
                        Pending Arbitration
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail view backdrop sheet */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease]">
          <div className="bg-white rounded-3xl p-5.5 w-full max-w-xl relative border shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <button 
              onClick={() => setSelectedOrder(null)}
              className="p-1.5 bg-slate-50 text-slate-400 hover:text-slate-800 rounded-full absolute right-4 top-4"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="space-y-1 border-b pb-2">
              <h3 className="text-sm font-black text-slate-900 uppercase">Interactive Order Docket</h3>
              <p className="text-[10.5px] text-pink-700 font-mono font-black uppercase">UID Ref: #{selectedOrder.id}</p>
            </div>

            {/* Highlighting banner if disputed */}
            {(selectedOrder.status?.toLowerCase().startsWith('dispute') || selectedOrder.status?.toLowerCase().includes('dispute')) && (
              <div className="bg-amber-50 border-[2.5px] border-amber-500 p-3.5 rounded-2.5xl space-y-2 text-slate-900">
                <div className="flex items-center gap-2 text-amber-850 font-black text-xs uppercase">
                  <AlertTriangle className="w-5 h-5 text-amber-700 animate-bounce" />
                  <span>Escrow On hold: Active Customer Dispute Case</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed font-semibold">
                  Buyer claims issue: <strong className="text-slate-900">"{selectedOrder.disputeReason || 'Unsatisfactory delivery condition or item mismatch'}"</strong>
                </p>

                <div className="pt-2">
                  <button
                    onClick={() => setIsResolveModalOpen(true)}
                    className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase transition-all shadow-3xs"
                  >
                    Open Arbitration Panel
                  </button>
                </div>
              </div>
            )}

            {/* Core Details */}
            <div className="grid grid-cols-2 gap-3.5 text-xs font-semibold p-3.5 rounded-2.5xl bg-slate-50">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">Buyer Details</span>
                <span className="block text-slate-900 font-bold">{selectedOrder.buyerName || 'ShopEasy Client'}</span>
                <span className="block text-[10.5px] font-mono text-slate-500">{selectedOrder.phone}</span>
                {selectedOrder.address && <p className="text-[10px] text-slate-500 block leading-tight mt-1 truncate">{selectedOrder.address}</p>}
              </div>
              <div className="space-y-0.5 border-l pl-3.5">
                <span className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">Merchant Store</span>
                <span className="block text-slate-900 font-bold">{selectedOrder.storeName || selectedOrder.sellerName}</span>
                <span className="block text-[10.5px] font-mono text-slate-500">{selectedOrder.sellerId || selectedOrder.storeId}</span>
                <span className="text-[10px] text-slate-500 mt-0.5 block font-sans">Territory: {selectedOrder.city}</span>
              </div>
            </div>

            {/* Line items list */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Order line-items</span>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {selectedOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center py-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-450 font-bold font-mono">x{item.qty || item.quantity || 1}</span>
                      <div>
                        <h5 className="font-bold text-slate-900">{item.title || item.productName || 'Local Product'}</h5>
                        {item.selectedColor && <span className="text-[9.5px] text-slate-450 mr-2 uppercase">Color: {item.selectedColor}</span>}
                        {item.selectedSize && <span className="text-[9.5px] text-slate-450 uppercase">Size: {item.selectedSize}</span>}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-slate-950">MWK {((item.price || 0) * (item.qty || item.quantity || 1)).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="border-t pt-3.5 flex justify-between items-center font-sans">
              <div className="text-slate-650 text-xs font-bold font-sans">
                Method: <span className="font-sans font-extrabold text-slate-900">{selectedOrder.paymentMethod || 'Mobile Money checkout'}</span>
              </div>
              <div className="text-right">
                <span className="text-[9.5px] uppercase tracking-wide text-slate-400 font-bold block">Grand Aggregate Total</span>
                <span className="font-mono text-base font-black text-rose-600 block">MWK {(selectedOrder.total || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARBITRATION SELECTION MODAL */}
      {isResolveModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 z-55 animate-[fadeIn_0.2s_ease]">
          <div className="bg-white rounded-3xl p-5.5 w-full max-w-md relative border shadow-2xl space-y-4">
            <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2 text-amber-700">
              <ShieldAlert className="w-5 h-5 shrink-0" /> Dispute Arbitration Panel
            </h3>

            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Verify customer evidence and merchant details. Select side representing correct compliance policy:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setResolutionSide('buyer')}
                className={`py-3.5 rounded-2xl border text-xs font-black uppercase transition flex flex-col items-center gap-1.5 ${
                  resolutionSide === 'buyer' 
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <ThumbsUp className="w-5 h-5 text-indigo-650" />
                <span>Side with Buyer</span>
              </button>
              
              <button
                type="button"
                onClick={() => setResolutionSide('seller')}
                className={`py-3.5 rounded-2xl border text-xs font-black uppercase transition flex flex-col items-center gap-1.5 ${
                  resolutionSide === 'seller' 
                    ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900' 
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <ThumbsDown className="w-5 h-5 text-emerald-650" />
                <span>Side with Seller</span>
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-[10.5px] uppercase font-black text-slate-450 tracking-wider">Arbitration Justification Log Reason</label>
              <textarea
                rows={3}
                placeholder="Declare administrative ruling explanation (e.g. proof of trackable delivery document verified)..."
                value={resolutionJustification}
                onChange={(e) => setResolutionJustification(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-205 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => { setIsResolveModalOpen(false); setResolutionSide(null); setResolutionJustification(''); }}
                className="flex-1 py-2.5 bg-slate-100 text-slate-705 font-bold rounded-xl text-xs transition"
              >
                Decline Resolution
              </button>
              <button
                onClick={handleResolveDispute}
                disabled={submittingAction || !resolutionSide || !resolutionJustification.trim()}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white disabled:bg-slate-100 disabled:text-slate-400 rounded-xl text-xs font-black uppercase transition shadow-3xs"
              >
                {submittingAction ? 'Enforcing...' : 'Enforce Ruling'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
