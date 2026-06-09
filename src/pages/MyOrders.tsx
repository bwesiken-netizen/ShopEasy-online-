import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useCartStore, useNotificationStore } from '../stores';
import { db, storage } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  ArrowLeft,
  ShoppingBag,
  MessageSquare,
  ChevronRight,
  User,
  AlertCircle,
  CheckCircle,
  Star,
  Camera,
  Trash2,
  X,
  CreditCard
} from 'lucide-react';

export default function MyOrders() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addItem, items: cartItems } = useCartStore();
  const { addNotification } = useNotificationStore();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [limit, setLimit] = useState(10);
  const [errorText, setErrorText] = useState('');

  // Review Modal State
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState<File | null>(null);
  const [reviewPhotoUrl, setReviewPhotoUrl] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Repayment State
  const [isRepaying, setIsRepaying] = useState<string | null>(null);

  // Tabs List
  const tabs = ['All', 'To Pay', 'Processing', 'Ready', 'Completed', 'Cancelled', 'Returns'];

  useEffect(() => {
    if (user?.uid) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setErrorText('');
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('buyerId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      
      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (!d.buyerHidden) {
          list.push({ id: doc.id, ...d });
        }
      });

      // Sort by createdAt descending
      list.sort((a, b) => {
        const timeA = a.createdAt ? (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt.toDate?.()?.getTime() || 0) : 0;
        const timeB = b.createdAt ? (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt.toDate?.()?.getTime() || 0) : 0;
        return timeB - timeA;
      });

      setOrders(list);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setErrorText('Could not load orders from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  // Status Badge Helper
  const getStatusDetails = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending_payment' || s === 'pending') {
      return { label: 'Awaiting Payment', bg: 'bg-amber-50 border-amber-100 text-amber-700', dot: 'bg-amber-500' };
    }
    if (s === 'processing' || s === 'paid') {
      return { label: 'Processing', bg: 'bg-blue-50 border-blue-100 text-blue-700', dot: 'bg-blue-500' };
    }
    if (s === 'ready') {
      return { label: 'Ready for Collection/Delivery', bg: 'bg-emerald-50 border-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
    }
    if (s === 'completed') {
      return { label: 'Completed', bg: 'bg-green-100 border-green-200 text-green-800', dot: 'bg-green-600' };
    }
    if (s === 'cancelled') {
      return { label: 'Cancelled', bg: 'bg-rose-50 border-rose-100 text-rose-700', dot: 'bg-rose-500' };
    }
    if (s.startsWith('dispute')) {
      return { label: 'Return Requested', bg: 'bg-orange-50 border-orange-100 text-orange-700', dot: 'bg-orange-500' };
    }
    return { label: status || 'Pending', bg: 'bg-neutral-50 border-neutral-150 text-neutral-600', dot: 'bg-neutral-400' };
  };

  // Filter items by tab
  const getFilteredOrders = () => {
    return orders.filter((order) => {
      const status = (order.status || '').toLowerCase();
      if (activeTab === 'All') return true;
      if (activeTab === 'To Pay') return status === 'pending_payment' || status === 'pending';
      if (activeTab === 'Processing') return status === 'processing' || status === 'paid';
      if (activeTab === 'Ready') return status === 'ready';
      if (activeTab === 'Completed') return status === 'completed';
      if (activeTab === 'Cancelled') return status === 'cancelled';
      if (activeTab === 'Returns') return status.startsWith('dispute');
      return true;
    });
  };

  // Actions
  const handlePayNow = async (order: any) => {
    try {
      setIsRepaying(order.id);
      setErrorText('');

      const cleanMail = user?.email || 'noreply@shopeasy.mw';
      const firstName = (order.buyerName || 'ShopEasy').split(' ')[0] || 'ShopEasy';
      const lastName = (order.buyerName || 'Customer').split(' ').slice(1).join(' ') || 'Customer';

      const returnUrlArgs = `?tx_ref=${order.id}&subtotal=${order.subtotal || order.total}&discount=${order.discount || 0}&total=${order.total}&buyerPhone=${encodeURIComponent(order.buyerPhone || '')}&buyerName=${encodeURIComponent(order.buyerName || '')}&deliveryType=${order.deliveryType || 'delivery'}`;
      const returnUrl = `${window.location.origin}${window.location.pathname}#/order-success${returnUrlArgs}`;

      const response = await fetch('/api/paychangu/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          totalAmount: order.total,
          userEmail: cleanMail,
          firstName,
          lastName,
          orderId: order.id,
          returnUrl
        })
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result?.error || 'Unable to re-initiate payment session');
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        throw new Error('No redirection URL provided by payment callback.');
      }
    } catch (err: any) {
      console.error('Repayment error:', err);
      setErrorText('Failed to direct to payment. Please retry.');
    } finally {
      setIsRepaying(null);
    }
  };

  const handleCancelOrder = async (order: any) => {
    const confirmCancel = window.confirm(`Are you sure you want to cancel order #${order.id}?`);
    if (!confirmCancel) return;

    try {
      const isPaidBefore = order.status === 'processing' || order.status === 'paid';
      const orderRef = doc(db, 'orders', order.id);
      
      await updateDoc(orderRef, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });

      // If already paid, alert admin for manual refund
      if (isPaidBefore) {
        const refundNotifRef = collection(db, 'notifications');
        await addDoc(refundNotifRef, {
          userId: 'admin',
          title: 'Refund Request Received! ⚠️',
          body: `A paid order #${order.id} of MWK ${order.total.toLocaleString()} was cancelled by buyer ${user.name}. Please process their manual refund via Paychangu.`,
          type: 'order',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      alert('Order cancelled successfully.');
      fetchOrders();
    } catch (err: any) {
      console.error('Cancel order error:', err);
      alert('Failed to cancel order.');
    }
  };

  const handleConfirmReceipt = async (order: any) => {
    const confirmReceipt = window.confirm('Confirm you received this order?');
    if (!confirmReceipt) return;

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'completed',
        completedAt: new Date().toISOString()
      });

      // Award coins to buyer: 100 coins for every 10,000 MWK spent (or total / 100)
      const earnedCoins = Math.floor(order.total / 100);
      if (earnedCoins > 0 && user?.uid) {
        // Increment buyer coins locally/Firestore
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          coins: (user.coins || 0) + earnedCoins
        });

        const txRef = collection(db, 'coinTransactions');
        await addDoc(txRef, {
          userId: user.uid,
          amount: earnedCoins,
          type: 'bonus',
          description: `Coins earned for completing order #${order.id}`,
          createdAt: serverTimestamp()
        });

        // Notify Buyer
        const buyerNotifRef = collection(db, 'notifications');
        await addDoc(buyerNotifRef, {
          userId: user.uid,
          title: 'You Earned Coins! 🪙',
          body: `Congratulations! You received ${earnedCoins} shopping coins for completing order #${order.id}.`,
          type: 'coin',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      // Notify seller of completion
      const sellerId = order.items?.[0]?.sellerId || order.items?.[0]?.storeId;
      if (sellerId) {
        const sellerNotifRef = collection(db, 'notifications');
        await addDoc(sellerNotifRef, {
          userId: sellerId,
          title: 'Order Completed! 🏪',
          body: `Superb! Buyer confirmed delivery for order #${order.id}. Funds are cleared!`,
          type: 'order',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      alert('Order marked as Completed. Zikomo!');
      
      // Check if product not reviewed yet
      if (!order.reviewSubmitted && order.items?.[0]) {
        const leaveReview = window.confirm('Leave a review for your purchase?');
        if (leaveReview) {
          openReviewModal(order, order.items[0]);
        } else {
          fetchOrders();
        }
      } else {
        fetchOrders();
      }
    } catch (err: any) {
      console.error('Confirm receipt failed:', err);
      alert('Error updating order delivery completion.');
    }
  };

  const handleBuyAgain = async (order: any) => {
    try {
      for (const item of order.items || []) {
        await addItem({
          id: item.productId,
          name: item.productName || item.title || 'Malawi Product',
          price: item.price,
          imageUrl: item.image || item.imageUrl || '📦',
          storeId: item.sellerId || item.storeId || '',
          storeName: item.storeName || 'ShopEasy Seller',
          stock: item.stock || 100
        }, {
          selectedColor: item.selectedColor || '',
          selectedSize: item.selectedSize || ''
        }, item.qty || item.quantity || 1);
      }
      navigate('/cart');
    } catch (err) {
      console.error('Buy again adding error:', err);
      alert('Items could not be re-added to cart.');
    }
  };

  const handleDeleteFromHistory = async (order: any) => {
    const confirmDelete = window.confirm('Are you sure you want to hide this order from history?');
    if (!confirmDelete) return;

    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        buyerHidden: true
      });
      alert('Order removed from account dashboard.');
      fetchOrders();
    } catch (err) {
      console.error('Delete history error:', err);
      alert('Failed to remove order record.');
    }
  };

  // Review Submissions
  const openReviewModal = (order: any, item: any) => {
    setSelectedOrder(order);
    setSelectedProduct(item);
    setReviewRating(5);
    setReviewText('');
    setReviewPhoto(null);
    setReviewPhotoUrl('');
    setIsReviewOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setReviewPhoto(e.target.files[0]);
    }
  };

  const submitProductReview = async () => {
    if (!reviewText.trim()) {
      alert('Please write at least a short review.');
      return;
    }

    try {
      setIsSubmittingReview(true);
      let uploadedUrl = '';

      if (reviewPhoto) {
        const photoName = `review_${selectedOrder.id}_${Date.now()}_${reviewPhoto.name}`;
        const photoStorageRef = ref(storage, `products/${selectedProduct.productId}/reviews/${photoName}`);
        const snapshot = await uploadBytes(photoStorageRef, reviewPhoto);
        uploadedUrl = await getDownloadURL(snapshot.ref);
      }

      // Add to reviews collection
      const reviewsRef = collection(db, 'reviews');
      await addDoc(reviewsRef, {
        productId: selectedProduct.productId,
        orderId: selectedOrder.id,
        buyerId: user.uid,
        buyerName: user.name || 'Anonymous User',
        rating: reviewRating,
        text: reviewText,
        photoUrl: uploadedUrl,
        createdAt: serverTimestamp()
      });

      // Update order to indicate reviewed
      const orderRef = doc(db, 'orders', selectedOrder.id);
      await updateDoc(orderRef, {
        reviewSubmitted: true
      });

      alert('✓ Review submitted successfully! Zikomo.');
      setIsReviewOpen(false);
      fetchOrders();
    } catch (err: any) {
      console.error('Product review submit failed:', err);
      alert('Failed to save your review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Timestamp format helper
  const formatDate = (dateInput: any) => {
    if (!dateInput) return '';
    let d: Date;
    if (typeof dateInput === 'string') {
      d = new Date(dateInput);
    } else if (dateInput.toDate) {
      d = dateInput.toDate();
    } else {
      d = new Date(dateInput);
    }
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const filteredOrders = getFilteredOrders();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 relative pb-16">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-neutral-100 z-10 px-4 py-3.5 flex items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/account')} className="p-1 hover:bg-neutral-100 rounded-full transition-all">
            <ArrowLeft className="h-5 w-5 text-neutral-800" />
          </button>
          <h1 className="font-display font-black text-lg text-neutral-900 leading-tight">My Orders</h1>
        </div>
        <div className="text-xs bg-red-50 text-[#E53935] border border-red-100 px-3 py-1 rounded-full font-bold">
          Malawi Shopping
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-neutral-100 py-3 px-4 flex gap-2 overflow-x-auto scrollbar-none snap-x sticky top-[53px] z-10">
        {tabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-black rounded-full transition-all whitespace-nowrap snap-center shrink-0 border ${
                isActive
                  ? 'bg-[#E53935] text-white border-[#E53935] shadow-sm'
                  : 'bg-neutral-50 border-neutral-100 text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Messages / Alerts banner */}
      {errorText && (
        <div className="mx-4 mt-4 bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-3xl flex items-center gap-3 text-xs leading-relaxed">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <p>{errorText}</p>
        </div>
      )}

      {/* Order Cards Container */}
      <div className="p-4 flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 border-4 border-[#E53935] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-neutral-500 mt-3 font-semibold">Synchronizing with Firestore database...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-neutral-100 p-6 shadow-sm flex flex-col items-center justify-center">
            <span className="text-5xl select-none mb-3">📦</span>
            <h3 className="font-extrabold text-neutral-800 text-sm">No {activeTab === 'All' ? '' : activeTab + ' '}orders</h3>
            <p className="text-xs text-neutral-400 mt-1.5 max-w-xs font-medium leading-relaxed">
              Whenever you place an order in ShopEasy, real-time tracking invoices will appear details here.
            </p>
            <button
              onClick={() => navigate('/shop')}
              className="mt-5 px-6 py-2.5 bg-[#E53935] text-white hover:bg-[#D32F2F] text-xs font-black rounded-full transition-all inline-flex items-center gap-1.5 shadow-sm"
            >
              <ShoppingBag className="h-4 w-4" /> Start Shopping
            </button>
          </div>
        ) : (
          filteredOrders.slice(0, limit).map((order) => {
            const statusStyle = getStatusDetails(order.status);
            const itemsInOrder = order.items || [];
            const isCollapsible = itemsInOrder.length > 3;
            const shownItems = itemsInOrder.slice(0, 3);
            const extraItemsCount = itemsInOrder.length - 3;

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition-all divide-y divide-neutral-50 overflow-hidden"
              >
                {/* Store Header & Date */}
                <div className="p-4 flex justify-between items-center gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-neutral-800 flex items-center gap-1.5">
                      🏪 {itemsInOrder[0]?.storeName || 'Malawi Local Supplier'}
                    </span>
                    <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider mt-0.5">
                      Order ID: {order.id} • Placed {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <div className={`text-[10px] font-black px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusStyle.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                    {statusStyle.label}
                  </div>
                </div>

                {/* Items Thumbnails Row */}
                <div
                  onClick={() => navigate(`/account/orders/${order.id}`)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    {shownItems.map((item: any, idx: number) => (
                      <div key={idx} className="relative h-12 w-12 rounded-xl bg-slate-100 border border-neutral-200/50 flex items-center justify-center overflow-hidden">
                        {item.image && (item.image.length === 1 || item.image.length === 2) ? (
                          <span className="text-2xl select-none">{item.image}</span>
                        ) : (
                          <img
                            src={item.image || item.imageUrl || '📦'}
                            alt={item.productName || 'Order Product'}
                            className="h-full w-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = 'https://placehold.co/100x100?text=📦';
                            }}
                          />
                        )}
                        <span className="absolute bottom-0 right-0 bg-neutral-900/80 text-white font-mono text-[9px] font-black px-1 rounded-tl-md">
                          x{item.qty || item.quantity || 1}
                        </span>
                      </div>
                    ))}

                    {isCollapsible && (
                      <div className="h-12 w-12 rounded-xl bg-[#E53935]/5 border border-[#E53935]/10 flex items-center justify-center text-[10px] font-black text-[#E53935]">
                        +{extraItemsCount} more
                      </div>
                    )}
                  </div>
                  <div>
                    <ChevronRight className="h-5 w-5 text-neutral-300" />
                  </div>
                </div>

                {/* Summary Info & Price */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/40">
                  <div className="text-xs font-medium text-neutral-550">
                    Handoff: <strong className="text-neutral-700 capitalize">{order.deliveryType || 'delivery'}</strong>
                  </div>
                  <div className="font-sans text-xs text-neutral-600 font-bold flex items-center gap-1 justify-end">
                    Total: <strong className="font-mono text-sm font-black text-neutral-900">MWK {order.total?.toLocaleString()}</strong>
                    <span className="text-[10px] font-medium text-neutral-400 font-sans">({itemsInOrder.length} {itemsInOrder.length === 1 ? 'item' : 'items'})</span>
                  </div>
                </div>

                {/* Status-driven Action Buttons */}
                <div className="p-3 bg-neutral-50/10 flex flex-wrap gap-2 justify-end">
                  {/* PENDING / UNPAID Actions */}
                  {(order.status === 'pending_payment' || order.status === 'pending') && (
                    <>
                      <button
                        onClick={() => handleCancelOrder(order)}
                        className="px-4 py-2 hover:bg-neutral-100 text-neutral-600 rounded-full text-xs font-black transition-all border border-neutral-200"
                      >
                        Cancel Order
                      </button>
                      <button
                        disabled={isRepaying === order.id}
                        onClick={() => handlePayNow(order)}
                        className="px-5 py-2 bg-[#E53935] hover:bg-[#D32F2F] text-white rounded-full text-xs font-black transition-all shadow-sm flex items-center gap-1.5"
                      >
                        {isRepaying === order.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <CreditCard className="h-3.5 w-3.5" />
                        )}
                        Pay Now
                      </button>
                    </>
                  )}

                  {/* PROCESSING / PAID Actions */}
                  {(order.status === 'processing' || order.status === 'paid') && (
                    <>
                      <button
                        onClick={() => handleCancelOrder(order)}
                        className="px-4 py-2 hover:bg-neutral-100 text-neutral-650 rounded-full text-xs font-bold transition-all border border-neutral-200"
                      >
                        Cancel Order
                      </button>
                      <button
                        onClick={() => navigate('/messages')}
                        className="px-4 py-2 bg-neutral-900 text-white hover:bg-neutral-800 rounded-full text-xs font-black transition-all inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Contact Seller
                      </button>
                    </>
                  )}

                  {/* READY Actions */}
                  {order.status === 'ready' && (
                    <>
                      <button
                        onClick={() => navigate('/messages')}
                        className="px-4 py-2 text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Contact Seller
                      </button>
                      <button
                        onClick={() => handleConfirmReceipt(order)}
                        className="px-5 py-2 bg-[#E53935] text-white hover:bg-[#D32F2F] rounded-full text-xs font-black transition-all inline-flex items-center gap-1 shadow-sm"
                      >
                        Confirm I Received It ✓
                      </button>
                    </>
                  )}

                  {/* COMPLETED Actions */}
                  {order.status === 'completed' && (
                    <>
                      <button
                        onClick={() => navigate(`/account/orders/${order.id}/dispute`)}
                        className="px-4 py-2 text-rose-650 bg-rose-50/50 border border-rose-200/50 hover:bg-rose-50 rounded-full text-xs font-extrabold transition-all"
                      >
                        Return/Dispute
                      </button>
                      <button
                        disabled={order.reviewSubmitted}
                        onClick={() => openReviewModal(order, itemsInOrder[0])}
                        className={`px-4 py-2 rounded-full text-xs font-black transition-all ${
                          order.reviewSubmitted
                            ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                            : 'bg-white text-neutral-800 border border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        {order.reviewSubmitted ? 'Review Written ✓' : 'Write Review'}
                      </button>
                      <button
                        onClick={() => handleBuyAgain(order)}
                        className="px-5 py-2 bg-[#E53935] text-white hover:bg-[#D32F2F] rounded-full text-xs font-black transition-all shadow-sm"
                      >
                        Buy Again
                      </button>
                    </>
                  )}

                  {/* CANCELLED Actions */}
                  {order.status === 'cancelled' && (
                    <>
                      <button
                        onClick={() => handleDeleteFromHistory(order)}
                        className="px-4 py-2 text-rose-600 bg-white border border-neutral-200 hover:bg-rose-50 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Hide History
                      </button>
                      <button
                        onClick={() => handleBuyAgain(order)}
                        className="px-5 py-2 bg-[#E53935] text-white hover:bg-[#D32F2F] rounded-full text-xs font-black transition-all shadow-sm"
                      >
                        Buy Again
                      </button>
                    </>
                  )}

                  {/* DEFAULT / RETURN DEFAULT Action */}
                  {order.status.startsWith('dispute') && (
                    <button
                      onClick={() => navigate(`/account/orders/${order.id}`)}
                      className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-full text-xs font-black transition-all"
                    >
                      Audit Dispute Progress
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Load More Button */}
        {!loading && filteredOrders.length > limit && (
          <button
            onClick={() => setLimit((prev) => prev + 10)}
            className="w-full mt-2 py-3 bg-white text-neutral-700 font-extrabold hover:bg-neutral-50 rounded-2xl border border-neutral-100 text-xs shadow-sm transition-all"
          >
            Load More Orders
          </button>
        )}
      </div>

      {/* Review Modal */}
      {isReviewOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-[fadeIn_0.2s_ease-out]">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-display font-black text-sm text-neutral-900">Write Product Review</h2>
              <button onClick={() => setIsReviewOpen(false)} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="h-5 w-5 text-neutral-400" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
              {/* Product Recap */}
              <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-2xl">
                <div className="h-10 w-10 shrink-0 bg-slate-100 rounded-lg flex items-center justify-center text-xl select-none">
                  {selectedProduct?.image || '📦'}
                </div>
                <div>
                  <h4 className="text-xs font-black text-neutral-800 line-clamp-1">
                    {selectedProduct?.productName || selectedProduct?.title}
                  </h4>
                  <p className="text-[10px] text-neutral-400 font-medium">
                    Store: {selectedOrder?.items?.[0]?.storeName || 'ShopEasy Seller'}
                  </p>
                </div>
              </div>

              {/* Star Rating Selection */}
              <div className="flex flex-col items-center py-2">
                <span className="text-xs font-bold text-neutral-500 mb-1.5">How would you rate this item?</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 text-amber-400 transition-all hover:scale-110"
                    >
                      <Star
                        className="h-7 w-7"
                        fill={star <= reviewRating ? 'currentColor' : 'transparent'}
                        stroke="currentColor"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-neutral-700">Your Review</label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share your experience with the item. Quality, scent, delivery accuracy? (Chonde lembani moni)"
                  rows={4}
                  className="w-full text-xs p-3 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-1 focus:ring-[#E53935] leading-relaxed resize-none"
                />
              </div>

              {/* Photo Upload */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-neutral-700">Attach Product Photo (Optional)</label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="file"
                      id="review-photo-picker"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                    />
                    <button
                      type="button"
                      className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200/50 text-neutral-700 text-xs font-black rounded-full transition-all inline-flex items-center gap-1.5"
                    >
                      <Camera className="h-4 w-4" /> Pick Photo
                    </button>
                  </div>
                  {reviewPhoto && (
                    <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Chosen: {reviewPhoto.name.substring(0, 16)}...
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                className="px-4 py-2 hover:bg-neutral-100 text-neutral-500 text-xs font-extrabold rounded-full transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={submitProductReview}
                className="px-5 py-2 bg-[#E53935] hover:bg-[#D32F2F] text-white text-xs font-black rounded-full transition-all shadow-sm flex items-center gap-1.5"
              >
                {isSubmittingReview && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
