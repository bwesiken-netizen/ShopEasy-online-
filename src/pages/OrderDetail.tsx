import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore, useNotificationStore } from '../stores';
import { db, storage } from '../firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  ArrowLeft,
  Copy,
  Check,
  MapPin,
  ClipboardList,
  MessageSquare,
  AlertTriangle,
  Coins,
  Star,
  Camera,
  CheckCircle2,
  Lock,
  Calendar,
  DollarSign
} from 'lucide-react';

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [copied, setCopied] = useState(false);

  // Review Modal State
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState<File | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    if (orderId && user?.uid) {
      fetchOrderDetail();
    }
  }, [orderId, user]);

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      setErrorText('');
      const orderRef = doc(db, 'orders', orderId!);
      const snapshot = await getDoc(orderRef);

      if (!snapshot.exists()) {
        // Fallback: check in checkout_intents if not completedly placed/verified yet
        const intentRef = doc(db, 'checkout_intents', orderId!);
        const intentSnap = await getDoc(intentRef);

        if (intentSnap.exists()) {
          const intentData = intentSnap.data();
          if (intentData.buyerId !== user.uid) {
            setErrorText('Permission denied: You do not own this order.');
            setLoading(false);
            return;
          }
          setOrder({ id: intentSnap.id, ...intentData, isIntentOnly: true });
        } else {
          setErrorText('Order record not found in database.');
        }
        setLoading(false);
        return;
      }

      const orderData = snapshot.data();
      if (orderData.buyerId !== user.uid) {
        setErrorText('Permission denied: You do not own this order.');
        setLoading(false);
        return;
      }

      setOrder({ id: snapshot.id, ...orderData });
    } catch (err: any) {
      console.error('Error fetching order detail:', err);
      setErrorText('Could not sync order information with Firestore.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOrderId = () => {
    if (!orderId) return;
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  // Check Timeline reached status
  const checkStatusReached = (step: string) => {
    if (!order) return false;
    const currentStatus = (order.status || '').toLowerCase();
    
    // Status hierarchy checking
    if (step === 'placed') {
      return true; // placing is always true
    }
    if (step === 'paid') {
      return (
        currentStatus === 'paid' ||
        currentStatus === 'processing' ||
        currentStatus === 'ready' ||
        currentStatus === 'completed' ||
        currentStatus.startsWith('dispute')
      );
    }
    if (step === 'processing') {
      return (
        currentStatus === 'processing' ||
        currentStatus === 'ready' ||
        currentStatus === 'completed' ||
        currentStatus.startsWith('dispute')
      );
    }
    if (step === 'ready') {
      return currentStatus === 'ready' || currentStatus === 'completed';
    }
    if (step === 'completed') {
      return currentStatus === 'completed';
    }
    return false;
  };

  // Review Dialog Open helper
  const openReviewDialog = (item: any) => {
    setSelectedProduct(item);
    setReviewRating(5);
    setReviewText('');
    setReviewPhoto(null);
    setIsReviewOpen(true);
  };

  const submitProductReview = async () => {
    if (!reviewText.trim()) {
      alert('Please fill in your review comment.');
      return;
    }

    try {
      setIsSubmittingReview(true);
      let uploadedUrl = '';

      if (reviewPhoto) {
        const photoName = `review_${orderId}_${Date.now()}_${reviewPhoto.name}`;
        const photoStorageRef = ref(storage, `products/${selectedProduct.productId}/reviews/${photoName}`);
        const snapshot = await uploadBytes(photoStorageRef, reviewPhoto);
        uploadedUrl = await getDownloadURL(snapshot.ref);
      }

      // Add to reviews
      const reviewsRef = collection(db, 'reviews');
      await addDoc(reviewsRef, {
        productId: selectedProduct.productId,
        orderId: order.id,
        buyerId: user.uid,
        buyerName: user.name || 'ShopEasy Member',
        rating: reviewRating,
        text: reviewText,
        photoUrl: uploadedUrl,
        createdAt: serverTimestamp()
      });

      // Update order state
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        reviewSubmitted: true
      });

      alert('✓ Review is successfully posted!');
      setIsReviewOpen(false);
      fetchOrderDetail();
    } catch (err) {
      console.error('Review submission err:', err);
      alert('Could not submit review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="h-8 w-8 border-4 border-[#E53935] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-neutral-500 mt-3 font-semibold">Reading invoice document...</p>
      </div>
    );
  }

  if (errorText) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <span className="text-5xl mb-3">⚠️</span>
        <h3 className="font-extrabold text-[#E53935] text-sm">Access Denied</h3>
        <p className="text-neutral-500 text-xs mt-1.5 max-w-xs leading-relaxed">{errorText}</p>
        <button
          onClick={() => navigate('/account/orders')}
          className="mt-6 px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-black rounded-full"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  if (!order) return null;

  const orderItems = order.items || [];
  const totalItemsCount = orderItems.reduce((acc: number, item: any) => acc + (item.qty || item.quantity || 1), 0);
  const sellerId = orderItems[0]?.sellerId || orderItems[0]?.storeId || '';
  const firstProductName = orderItems[0]?.productName || orderItems[0]?.title || 'item';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      {/* Top Header */}
      <div className="sticky top-0 bg-white border-b border-neutral-100 z-10 px-4 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/account/orders')} className="p-1 hover:bg-slate-100 rounded-full">
            <ArrowLeft className="h-5 w-5 text-neutral-800" />
          </button>
          <div className="flex flex-col">
            <h1 className="font-display font-black text-sm text-neutral-900 leading-tight">Order Details</h1>
            <p className="text-[10px] text-neutral-450 font-semibold uppercase mt-0.5">ShopEasy Malawi Verification</p>
          </div>
        </div>
        <div className="text-[10px] uppercase font-black tracking-widest bg-slate-100 border border-neutral-200/50 px-2.5 py-1 rounded-md text-neutral-600">
          Invoice
        </div>
      </div>

      {/* Main Container */}
      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto w-full">
        {/* Order Identifier Panel */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between gap-1">
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider">Reference Code</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-xs font-black text-neutral-900">{order.id}</span>
                <button
                  onClick={handleCopyOrderId}
                  className="p-1 hover:bg-neutral-100 rounded-lg transition-all text-neutral-450 hover:text-neutral-700"
                  title="Copy Reference"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                {copied && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1 border border-emerald-100 rounded">Copied!</span>}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider block">Total Amount</span>
              <span className="font-mono text-sm font-black text-[#E53935] block mt-0.5">
                MWK {order.total?.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="pt-2.5 border-t border-dashed border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500 font-medium">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-neutral-400" /> Placed: {formatDate(order.createdAt)}
            </div>
            {order.isIntentOnly && (
              <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Awaiting Hook Verify
              </span>
            )}
          </div>
        </div>

        {/* STATUS TIMELINE (stepper) */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm">
          <h3 className="font-display font-black text-xs text-neutral-800 mb-4 flex items-center gap-2">
            <ClipboardList className="h-4.5 w-4.5 text-[#E53935]" /> Tracking Stepper Timeline
          </h3>

          <div className="flex flex-col gap-5 pl-2 relative border-l-2 border-neutral-100 ml-3">
            {/* Step 1: Placed */}
            <div className="relative pl-6">
              <div className={`absolute left-[-15px] top-0 h-6 w-6 rounded-full border-2 flex items-center justify-center bg-white ${
                checkStatusReached('placed') ? 'border-emerald-600 text-emerald-600' : 'border-neutral-200 text-neutral-400'
              }`}>
                {checkStatusReached('placed') ? <Check className="h-3.5 w-3.5 font-bold" /> : <div className="h-1.5 w-1.5 rounded-full bg-neutral-300" />}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-neutral-800 leading-tight">Order Placed</span>
                <span className="text-[10px] text-neutral-450 mt-0.5 font-bold">Successfully initialized and queued.</span>
              </div>
            </div>

            {/* Step 2: Paid */}
            <div className="relative pl-6">
              <div className={`absolute left-[-15px] top-0 h-6 w-6 rounded-full border-2 flex items-center justify-center bg-white ${
                checkStatusReached('paid') ? 'border-emerald-600 text-emerald-600' : 'border-neutral-200 text-neutral-400'
              }`}>
                {checkStatusReached('paid') ? <Check className="h-3.5 w-3.5 font-bold" /> : <div className="h-1.5 w-1.5 rounded-full bg-neutral-300" />}
              </div>
              <div className="flex flex-col">
                <span className={`text-xs font-black leading-tight ${checkStatusReached('paid') ? 'text-emerald-700' : 'text-neutral-800'}`}>
                  Payment Confirmed
                </span>
                <span className="text-[10px] text-neutral-450 mt-0.5 font-bold">
                  {checkStatusReached('paid') ? 'Secure checkout clearance completed.' : 'Awaiting payment verification.'}
                </span>
              </div>
            </div>

            {/* Step 3: Seller Processing */}
            <div className="relative pl-6">
              <div className={`absolute left-[-15px] top-0 h-6 w-6 rounded-full border-2 flex items-center justify-center bg-white ${
                checkStatusReached('processing') ? 'border-emerald-600 text-emerald-600' : 'border-neutral-200 text-neutral-400'
              }`}>
                {checkStatusReached('processing') ? <Check className="h-3.5 w-3.5 font-bold" /> : <div className="h-1.5 w-1.5 rounded-full bg-neutral-300" />}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-neutral-800 leading-tight">Seller Processing</span>
                <span className="text-[10px] text-neutral-450 mt-0.5 font-bold">The farm shop is bundling your goods.</span>
              </div>
            </div>

            {/* Step 4: Ready */}
            <div className="relative pl-6">
              <div className={`absolute left-[-15px] top-0 h-6 w-6 rounded-full border-2 flex items-center justify-center bg-white ${
                checkStatusReached('ready') ? 'border-emerald-600 text-emerald-600' : 'border-neutral-200 text-neutral-400'
              }`}>
                {checkStatusReached('ready') ? <Check className="h-3.5 w-3.5 font-bold" /> : <div className="h-1.5 w-1.5 rounded-full bg-neutral-300" />}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-neutral-800 leading-tight">Ready for Collection / Delivery</span>
                <span className="text-[10px] text-neutral-450 mt-0.5 font-bold">Packaged and awaiting handoff details.</span>
              </div>
            </div>

            {/* Step 5: Completed */}
            <div className="relative pl-6">
              <div className={`absolute left-[-15px] top-0 h-6 w-6 rounded-full border-2 flex items-center justify-center bg-white ${
                checkStatusReached('completed') ? 'border-emerald-600 text-emerald-600' : 'border-neutral-200 text-neutral-400'
              }`}>
                {checkStatusReached('completed') ? <Check className="h-3.5 w-3.5 font-bold" /> : <div className="h-1.5 w-1.5 rounded-full bg-neutral-300" />}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black text-neutral-800 leading-tight">Completed</span>
                <span className="text-[10px] text-neutral-450 mt-0.5 font-bold">Receipt confirmed by buyer. Zikomo kwambiri!</span>
              </div>
            </div>
          </div>
        </div>

        {/* DELIVERY INFO BOX */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col gap-3">
          <h3 className="font-display font-black text-xs text-neutral-800 border-b border-neutral-50 pb-2 flex items-center gap-2">
            <MapPin className="h-4.5 w-4.5 text-[#E53935]" /> Delivery Info Box
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-neutral-450 font-bold block uppercase tracking-wider">Handoff Method</span>
              <strong className="text-neutral-800 capitalize block mt-0.5">{order.deliveryType || 'Standard'}</strong>
            </div>
            <div>
              <span className="text-[10px] text-neutral-450 font-bold block uppercase tracking-wider">Recipient Name</span>
              <strong className="text-neutral-800 block mt-0.5">{order.buyerName || user.name}</strong>
            </div>
            <div className="col-span-2">
              <span className="text-[10px] text-neutral-450 font-bold block uppercase tracking-wider">Address Location</span>
              <strong className="text-neutral-800 block mt-0.5">
                {order.deliveryInfo?.area ? `${order.deliveryInfo.area}, ` : ''}
                {order.deliveryInfo?.city || 'Lilongwe'}, Malawi
              </strong>
            </div>
            {order.deliveryInfo?.landmark && (
              <div className="col-span-2">
                <span className="text-[10px] text-neutral-450 font-bold block uppercase tracking-wider">Landmark Details</span>
                <strong className="text-neutral-800 block mt-0.5">{order.deliveryInfo.landmark}</strong>
              </div>
            )}
            {order.note && (
              <div className="col-span-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100/50">
                <span className="text-[10px] text-amber-800 font-extrabold block uppercase tracking-wider">Note to Seller</span>
                <p className="text-xs text-neutral-700 mt-1 font-medium leading-relaxed italic">"{order.note}"</p>
              </div>
            )}
          </div>
        </div>

        {/* ITEMS LIST */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col gap-3.5">
          <h3 className="font-display font-black text-xs text-neutral-800 border-b border-neutral-50 pb-2">
            Consolidated Items ({totalItemsCount})
          </h3>

          <div className="flex flex-col gap-3">
            {orderItems.map((item: any, idx: number) => (
              <div key={idx} className="flex gap-3 justify-between items-start">
                <div className="flex gap-3 items-center">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 border border-neutral-200/50 flex items-center justify-center overflow-hidden shrink-0 text-xl font-bold">
                    {item.image && (item.image.length === 1 || item.image.length === 2) ? (
                      item.image
                    ) : (
                      <img
                        src={item.image || item.imageUrl || '📦'}
                        alt={item.productName || 'product'}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-neutral-800 line-clamp-1">{item.productName || item.title}</h4>
                    {item.selectedColor || item.selectedSize ? (
                      <span className="text-[9px] text-neutral-400 font-bold uppercase block mt-0.5">
                        {item.selectedColor ? `Color: ${item.selectedColor} ` : ''}
                        {item.selectedSize ? `Size: ${item.selectedSize}` : ''}
                      </span>
                    ) : (
                      <span className="text-[9px] text-neutral-400 font-bold uppercase block mt-0.5">Default Variant</span>
                    )}
                    <span className="text-xs font-bold font-mono text-neutral-500 block mt-1">
                      {item.qty || item.quantity || 1} × MWK {item.price?.toLocaleString()}
                    </span>
                  </div>
                </div>

                {order.status === 'completed' && !order.reviewSubmitted && (
                  <button
                    onClick={() => openReviewDialog(item)}
                    className="p-1 px-3 text-[10px] bg-red-50 text-[#E53935] border border-red-200 rounded-full font-black hover:bg-red-100 transition-all"
                  >
                    Write Review
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* PAYMENT SUMMARY */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col gap-3.5">
          <h3 className="font-display font-black text-xs text-neutral-800 border-b border-neutral-50 pb-2 flex items-center justify-between">
            <span>Payment Breakdown</span>
            <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded uppercase font-black tracking-widest text-[#E53935]">
              Paychangu
            </span>
          </h3>

          <div className="flex flex-col gap-2.5 text-xs">
            <div className="flex justify-between text-neutral-550 font-medium">
              <span>Payment Status</span>
              <strong className={`flex items-center gap-1.5 ${
                order.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {order.paymentStatus === 'paid' ? '✅ Fully Paid' : '⏳ Pending Payment'}
              </strong>
            </div>

            {order.paychanguTxRef && (
              <div className="flex justify-between text-neutral-550 font-medium">
                <span>Transaction Ref</span>
                <span className="font-mono text-[11px] font-black text-neutral-800">{order.paychanguTxRef}</span>
              </div>
            )}

            <div className="pt-2.5 border-t border-neutral-50 flex justify-between text-neutral-500 font-medium">
              <span>Subtotal</span>
              <span className="font-mono text-neutral-800">MWK {order.subtotal?.toLocaleString() || order.total?.toLocaleString()}</span>
            </div>

            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>Coupon Discount ({order.couponUsed || 'Coupon code'})</span>
                <span className="font-mono">-MWK {order.discount.toLocaleString()}</span>
              </div>
            )}

            <div className="pt-2.5 border-t border-neutral-100 flex justify-between text-neutral-900 font-extrabold text-sm font-sans">
              <span>Total Capital Paid</span>
              <span className="font-mono text-[#E53935]">MWK {order.total?.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* PAGE ACTIONS PANEL */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate(`/messages?chatWith=${sellerId}&productName=${encodeURIComponent(firstProductName)}`)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-black rounded-full text-xs transition-all shadow-sm"
          >
            <MessageSquare className="h-4.5 w-4.5" /> 💬 Contact Seller Shop
          </button>

          <button
            onClick={() => navigate(`/account/orders/${order.id}/dispute`)}
            className="w-full text-rose-650 bg-rose-50 hover:bg-rose-100 border border-rose-200/50 py-3 font-black rounded-full text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <AlertTriangle className="h-4.5 w-4.5" /> Report a Problem / Return File
          </button>
        </div>
      </div>

      {/* Review Modal Trigger */}
      {isReviewOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl animate-[fadeIn_0.2s_ease-out]">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-display font-black text-sm text-neutral-900">Review Product</h2>
              <button onClick={() => setIsReviewOpen(false)} className="p-1 hover:bg-slate-100 rounded-full">
                ⏳ Close
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
              <div className="flex gap-3 items-center p-3 bg-neutral-50 rounded-2xl">
                <div className="h-10 w-10 shrink-0 bg-neutral-100 rounded-lg flex items-center justify-center text-xl select-none">
                  {selectedProduct?.image || '📦'}
                </div>
                <div>
                  <h4 className="text-xs font-black text-neutral-800 line-clamp-1">{selectedProduct?.productName}</h4>
                  <p className="text-[10px] text-neutral-450 font-medium">Earn additional coins on reviews.</p>
                </div>
              </div>

              {/* Star controls */}
              <div className="flex flex-col items-center py-2">
                <span className="text-xs font-bold text-neutral-400 mb-1.5">Your Rating</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setReviewRating(s)} className="p-1 text-amber-500 hover:scale-105 transition-all">
                      <Star className="h-7 w-7" fill={s <= reviewRating ? 'currentColor' : 'transparent'} stroke="currentColor" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-neutral-700">Write review details</label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Tell others what you love or dislike..."
                  rows={4}
                  className="w-full text-xs p-3 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-1 focus:ring-[#E53935]"
                />
              </div>

              {/* Picture */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black text-neutral-700">Attach supporting photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && setReviewPhoto(e.target.files[0])}
                  className="text-xs text-neutral-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex gap-2 justify-end">
              <button onClick={() => setIsReviewOpen(false)} className="px-4 py-2 hover:bg-neutral-100 text-neutral-500 text-xs font-bold rounded-full">
                Cancel
              </button>
              <button
                disabled={isSubmittingReview}
                onClick={submitProductReview}
                className="px-5 py-2 bg-[#E53935] text-white text-xs font-black hover:bg-[#D32F2F] rounded-full transition-all flex items-center gap-1"
              >
                {isSubmittingReview && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                Save Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
