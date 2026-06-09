import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { 
  ArrowLeft, 
  MessageSquare, 
  Truck, 
  Box, 
  CheckCircle, 
  XOctagon, 
  User, 
  Phone, 
  MapPin, 
  Clipboard, 
  Calendar,
  AlertCircle,
  Clock,
  CornerUpLeft,
  DollarSign
} from 'lucide-react';

export default function SellerOrders() {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid;

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'All' | 'Processing' | 'Ready' | 'Completed' | 'Cancelled' | 'Returns'>('Processing');

  // Contact Buyer Loader state
  const [chatLoading, setChatLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;

    // Load store profile to know seller name
    const fetchStore = async () => {
      try {
        const docRef = doc(db, 'stores', uid);
        const storeSnap = await getDoc(docRef);
        if (storeSnap.exists()) {
          setStore(storeSnap.data());
        }
      } catch (err) {
        console.error("Error loaded store details for layout:", err);
      }
    };

    fetchStore();
    fetchOrders();
  }, [uid]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'orders'), where('storeId', '==', uid));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort in-memory by createdAt desc
      list.sort((a, b) => {
        const secondsA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt || 0).getTime() / 1000;
        const secondsB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt || 0).getTime() / 1000;
        return secondsB - secondsA;
      });
      setOrders(list);
    } catch (err) {
      console.error("Error loaded seller orders list:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, nextStatus: string) => {
    if (!window.confirm(`Are you sure you want to transition this order state to "${nextStatus.toUpperCase()}"?`)) {
      return;
    }
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: nextStatus
      });
      alert(`✓ Order #${orderId.slice(0, 7).toUpperCase()} is now update to "${nextStatus}" status.`);
      fetchOrders();
    } catch (err: any) {
      alert("Failed to update order status: " + err.message);
    }
  };

  // Chat conversation initializer
  const handleContactBuyer = async (order: any) => {
    if (!uid || !order.buyerId) return;
    
    setChatLoading(order.id);
    try {
      // 1. Search if conversation exists between buyerId and sellerId (uid)
      const q = query(
        collection(db, 'conversations'),
        where('buyerId', '==', order.buyerId),
        where('sellerId', '==', uid)
      );

      const snap = await getDocs(q);
      let targetConvId = '';

      if (!snap.empty) {
        // Conversation already exists
        targetConvId = snap.docs[0].id;
      } else {
        // Create matching dialogue conversation
        const payload = {
          buyerId: order.buyerId,
          buyerName: order.buyerName || 'ShopEasy Buyer',
          sellerId: uid,
          sellerName: store?.name || 'ShopEasy Merchant',
          lastMessage: `Hello! I am getting in touch with reference to your Order #${order.id.slice(0, 7).toUpperCase()} on my store.`,
          lastSenderId: uid,
          readByBuyer: false,
          readBySeller: true,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        };
        const newDocRef = await addDoc(collection(db, 'conversations'), payload);
        targetConvId = newDocRef.id;

        // Add initial greeting message
        await addDoc(collection(db, 'conversations', targetConvId, 'messages'), {
          senderId: uid,
          receiverId: order.buyerId,
          text: payload.lastMessage,
          createdAt: serverTimestamp(),
          read: false
        });
      }

      // Route custom buyer layout
      navigate(`/messages/${targetConvId}`);
    } catch (err: any) {
      console.error("Initiated conversation failure:", err);
      alert("Could not start buyer conversation chat: " + err.message);
    } finally {
      setChatLoading(null);
    }
  };

  // Filter list by selected status tabs
  const filteredOrders = orders.filter((o) => {
    const status = o.status || 'pending';
    const isDispute = o.disputeStatus !== undefined || o.status === 'returned';

    if (activeTab === 'Processing') {
      return status === 'pending' || status === 'processing';
    }
    if (activeTab === 'Ready') {
      return status === 'ready' || status === 'dispatched';
    }
    if (activeTab === 'Completed') {
      return status === 'completed';
    }
    if (activeTab === 'Cancelled') {
      return status === 'cancelled';
    }
    if (activeTab === 'Returns') {
      return isDispute || status === 'disputed' || status === 'refunded';
    }
    return true; // All
  });

  // Calculate clean elapsed text
  const getElapsedDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    let dateObj = new Date();
    if (timestamp.seconds) {
      dateObj = new Date(timestamp.seconds * 1000);
    } else {
      dateObj = new Date(timestamp);
    }
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4" id="seller-orders-control">
      
      {/* Category selector */}
      <div className="flex bg-white border p-1 rounded-xl shadow-3xs overflow-x-auto text-center gap-1 select-none scrollbar-none">
        {(['All', 'Processing', 'Ready', 'Completed', 'Cancelled', 'Returns'] as const).map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[76px] py-1.5 text-[10px] uppercase font-black tracking-wider rounded-lg transition ${
                isSelected 
                  ? 'bg-red-650 bg-red-600 text-white shadow-3xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center text-slate-400 text-xs text-center font-bold">
          <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-2" />
          Querying customer transactions...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border text-slate-400 text-xs space-y-2">
          <Clipboard className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold">No orders in this category.</p>
          <p className="text-[10px] text-slate-450">Fulfillment orders received from local buyers show up here.</p>
        </div>
      ) : (
        <div className="space-y-4.5">
          {filteredOrders.map((ord) => {
            const dateStr = getElapsedDate(ord.createdAt);
            const status = ord.status || 'pending';

            const isProcessing = status === 'pending' || status === 'processing';
            const isReady = status === 'ready' || status === 'dispatched';
            const isCompleted = status === 'completed';
            const isCancelled = status === 'cancelled';

            return (
              <div 
                key={ord.id}
                className="bg-white rounded-2xl border border-slate-100 p-4 shadow-3xs space-y-3.5 relative overflow-hidden"
              >
                {/* Header Info */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-2.5">
                  <div className="space-y-1">
                    <span className="font-mono text-[11px] font-extrabold text-slate-900 block uppercase">
                      Order #{ord.id.slice(0, 7).toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-slate-350" /> {dateStr}
                    </span>
                  </div>

                  {/* Status Badging */}
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isCompleted 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                        : isProcessing 
                          ? 'bg-amber-50 text-amber-800 border border-amber-100' 
                          : isCancelled 
                            ? 'bg-slate-50 text-slate-400' 
                            : 'bg-blue-50 text-blue-800 border border-blue-100'
                    }`}>
                      {status}
                    </span>
                    {ord.deliveryMethod && (
                      <span className="text-[9.5px] text-slate-450 uppercase font-black font-sans">
                        {ord.deliveryMethod === 'pickup' ? '🛍️ In-store Pickup' : '🚗 City delivery'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Buyer section */}
                <div className="bg-slate-50/50 p-2.5 rounded-xl border border-dashed space-y-1.5 text-[11.5px] text-slate-700">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>Buyer: {ord.buyerName || 'ShopEasy Buyer'}</span>
                  </div>
                  {ord.buyerPhone && (
                    <div className="flex items-center gap-1.5 font-semibold text-slate-650">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>Phone: {ord.buyerPhone}</span>
                    </div>
                  )}
                  {ord.deliveryAddress && (
                    <div className="flex items-start gap-1.5 text-slate-600 font-sans font-medium line-clamp-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>Address: {ord.deliveryAddress?.street || ord.deliveryAddress}</span>
                    </div>
                  )}
                </div>

                {/* Purchased items list */}
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Purchased items</span>
                  <div className="divide-y divide-slate-100">
                    {(ord.items || []).map((item: any, idx: number) => {
                      const image = item.imageUrl || item.image || '📦';
                      const isEmoji = image.length <= 4;

                      return (
                        <div key={idx} className="flex gap-3.5 py-2 text-xs">
                          {/* Image thumbnail */}
                          <div className="w-10 h-10 bg-slate-50 border rounded-lg overflow-hidden flex items-center justify-center text-xl shrink-0">
                            {isEmoji ? (
                              image
                            ) : (
                              <img referrerPolicy="no-referrer" src={image} alt={item.name} className="w-full h-full object-cover" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-0.5">
                            <h5 className="font-bold text-slate-900 truncate">{item.name || item.title}</h5>
                            <span className="text-[10.5px] text-slate-450 font-mono">
                              MWK {item.price?.toLocaleString()} × {item.quantity || 1}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono font-bold text-slate-900 block text-[11px]">
                              MWK {((item.price || 0) * (item.quantity || 1)).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Subtotals & Total */}
                <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center text-xs">
                  <span className="text-slate-450 font-bold uppercase tracking-wider">Checkout Total:</span>
                  <span className="text-sm font-bold font-mono text-red-650 text-red-650 text-red-650 text-red-650 font-black">
                    MWK {(ord.total || 0).toLocaleString()}
                  </span>
                </div>

                {/* Action buttons (Transition & Chat) */}
                <div className="pt-2 flex gap-2.5">
                  
                  {/* Transition actions */}
                  {isProcessing && (
                    <button
                      type="button"
                      onClick={() => handleUpdateOrderStatus(ord.id, 'ready')}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] py-2.5 px-3 rounded-xl transition uppercase tracking-wider flex items-center justify-center gap-1 shadow-3xs"
                    >
                      <Box className="w-3.5 h-3.5" /> Mark Ready / Dispatched
                    </button>
                  )}

                  {isReady && (
                    <button
                      type="button"
                      onClick={() => handleUpdateOrderStatus(ord.id, 'completed')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] py-2.5 px-3 rounded-xl transition uppercase tracking-wider flex items-center justify-center gap-1 shadow-3xs"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Completed / Delivered
                    </button>
                  )}

                  {/* Chat initiator */}
                  <button
                    type="button"
                    disabled={chatLoading === ord.id}
                    onClick={() => handleContactBuyer(ord)}
                    className="bg-slate-920 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2.5 rounded-xl transition flex items-center gap-1 justify-center shrink-0"
                    title="Chat with Buyer"
                  >
                    <MessageSquare className="w-4.5 h-4.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {chatLoading === ord.id ? 'Connecting...' : 'Buyer Chat'}
                    </span>
                  </button>

                  {/* Return disputes handling */}
                  {ord.status === 'disputed' && (
                    <button
                      onClick={() => navigate(`/dispute/${ord.id}`)}
                      className="flex-1 bg-amber-550 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] py-2.5 px-3 rounded-xl transition uppercase flex items-center justify-center gap-1 shrink-0"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5" /> Handle Return Dispute
                    </button>
                  )}

                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
