import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { db, storage } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  ArrowLeft,
  AlertOctagon,
  Camera,
  Trash2,
  X,
  FileCheck2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
  Coins,
  DollarSign
} from 'lucide-react';

interface LocalPhoto {
  id: string;
  file: File;
  preview: string;
}

export default function Dispute() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [resolution, setResolution] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Reason mapping list
  const reasons = [
    'Wrong item received',
    'Item arrived damaged',
    'Item not as described',
    'Item never received',
    'Changed my mind'
  ];

  // Resolution options
  const resolutions = [
    { value: 'replacement', label: 'Replacement (if in stock)', icon: RefreshCw },
    { value: 'refund', label: 'Refund via Paychangu (3–5 business days)', icon: DollarSign },
    { value: 'coins', label: 'Store Credit as Coins (instant + 10% bonus)', icon: Coins }
  ];

  useEffect(() => {
    if (orderId && user?.uid) {
      fetchOrderDetails();
    }
  }, [orderId, user]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setErrorText('');
      const orderRef = doc(db, 'orders', orderId!);
      const snapshot = await getDoc(orderRef);

      if (!snapshot.exists()) {
        setErrorText('Order record not found in database.');
        setLoading(false);
        return;
      }

      const orderData = snapshot.data();
      if (orderData.buyerId !== user.uid) {
        setErrorText('Permission denied: You do not have permissions to access this order.');
        setLoading(false);
        return;
      }

      setOrder({ id: snapshot.id, ...orderData });
    } catch (err: any) {
      console.error('Error fetching order detail for dispute:', err);
      setErrorText('Failed to verify order details with Firestore.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (photos.length + files.length > 5) {
      alert('You can upload up to 5 photos max.');
      return;
    }

    const newPhotos: LocalPhoto[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = 'ph_' + Math.random().toString(36).substring(2, 9);
      const preview = URL.createObjectURL(file);
      newPhotos.push({ id, file, preview });
    }

    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const handleRemovePhoto = (id: string, previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason) {
      alert('Please select a dispute reason.');
      return;
    }
    if (description.trim().length < 30) {
      alert('Problem description must be at least 30 characters.');
      return;
    }
    if (!resolution) {
      alert('Please select your preferred resolution.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorText('');

      const uploadedUrls: string[] = [];

      // 1. Upload Support Photos sequentially onto Firebase Storage
      for (let i = 0; i < photos.length; i++) {
        const photoObj = photos[i];
        const timestamp = Date.now();
        const photoName = `${user.uid}_${timestamp}_${i}.jpg`;
        const storageRef = ref(storage, `disputes/${orderId}/${photoName}`);
        
        const snapshot = await uploadBytes(storageRef, photoObj.file);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        uploadedUrls.push(downloadUrl);
      }

      const sellerId = order.items?.[0]?.sellerId || order.items?.[0]?.storeId || 'general_store';

      // 2. Write Dispute Document to disputes/{orderId}
      await setDoc(doc(db, 'disputes', orderId!), {
        orderId,
        buyerId: user.uid,
        buyerName: order.buyerName || user.name || 'Anonymous',
        buyerPhone: order.buyerPhone || user.phone || '',
        sellerId,
        storeId: sellerId,
        reason,
        description,
        photos: uploadedUrls,
        resolution,
        status: 'open',
        createdAt: serverTimestamp()
      });

      // 3. Update Order status
      await updateDoc(doc(db, 'orders', orderId!), {
        status: 'dispute_open',
        disputedAt: new Date().toISOString()
      });

      // 4. Create Notification for Admin (Firestore notifications)
      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, {
        userId: 'admin',
        title: 'New Dispute Opened! 🚨',
        body: `Buyer ${order.buyerName || user.name} opened a dispute for Order #${orderId} citing: "${reason}".`,
        type: 'order',
        orderId,
        read: false,
        createdAt: serverTimestamp()
      });

      // 5. Create Notification for Seller (Firestore notifications)
      if (sellerId) {
        await addDoc(notificationsRef, {
          userId: sellerId,
          title: 'Dispute / Return Opened! ⚠️',
          body: `Order #${orderId} was disputed by user ${order.buyerName || user.name}. Please inspect the problem details.`,
          type: 'order',
          orderId,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      setSuccessMsg("Dispute submitted. We'll review within 48 hours.");
      // Revoke all local previews from memory
      photos.forEach(p => URL.revokeObjectURL(p.preview));
      
      // Auto redirect back to order details after 3 seconds
      setTimeout(() => {
        navigate(`/account/orders/${orderId}`);
      }, 3000);

    } catch (err: any) {
      console.error('Error submitting dispute:', err);
      setErrorText('Failed to log dispute records inside Firestore. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="h-8 w-8 border-4 border-[#E53935] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-neutral-500 mt-3 font-semibold">Loading dispute console...</p>
      </div>
    );
  }

  if (errorText && !successMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <span className="text-5xl mb-3">⚠️</span>
        <h3 className="font-extrabold text-[#E53935] text-sm font-sans">Access Denied</h3>
        <p className="text-neutral-500 text-xs mt-1.5 max-w-xs">{errorText}</p>
        <button
          onClick={() => navigate('/account/orders')}
          className="mt-6 px-6 py-2.5 bg-neutral-900 border border-neutral-950 text-white text-xs font-black rounded-full"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  if (!order) return null;

  const firstItem = order.items?.[0] || {};

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-neutral-100 z-10 px-4 py-3.5 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(`/account/orders/${orderId}`)} className="p-1 hover:bg-slate-100 rounded-full">
          <ArrowLeft className="h-5 w-5 text-neutral-800" />
        </button>
        <div className="flex flex-col">
          <h1 className="font-display font-black text-sm text-neutral-900 leading-tight">Report a Problem</h1>
          <p className="text-[10px] text-neutral-450 font-semibold uppercase mt-0.5">Dispute Case Resolver</p>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto w-full flex flex-col gap-4">
        {/* Success Alert */}
        {successMsg ? (
          <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-800 p-6 rounded-3xl text-center shadow-lg animate-[fadeIn_0.3s_ease]">
            <span className="text-5xl mb-4 select-none block text-center">🎉</span>
            <h2 className="font-display font-black text-base text-emerald-900 leading-tight">Dispute Filed Successfully!</h2>
            <p className="text-xs text-emerald-700 leading-relaxed max-w-xs mx-auto mt-2 font-semibold">
              ✅ {successMsg}
            </p>
            <p className="text-[10px] text-emerald-500 font-bold uppercase mt-4">
              Redirecting back to order record in 3 seconds...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmitDispute} className="flex flex-col gap-4">
            
            {/* Product recap box */}
            <div className="bg-white rounded-3xl p-4 border border-neutral-150/40 shadow-xs flex items-center gap-3">
              <div className="h-12 w-12 bg-slate-150/50 rounded-xl flex items-center justify-center text-2xl select-none shrink-0 border border-neutral-100">
                {firstItem.image || '📦'}
              </div>
              <div>
                <span className="text-[9px] text-neutral-400 font-bold uppercase block tracking-wider">Disputing Item</span>
                <h4 className="text-xs font-black text-neutral-800 leading-tight line-clamp-1 mt-0.5">
                  {firstItem.productName || firstItem.title}
                </h4>
                <p className="text-xs font-bold font-mono text-neutral-500 mt-1">
                  Value Amount: MWK {(firstItem.price || order.total)?.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Step 1: Reason Selector */}
            <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col gap-3">
              <label className="text-xs font-black text-neutral-800 flex items-center gap-1.5 border-b border-neutral-50 pb-2">
                <AlertOctagon className="h-4 w-4 text-[#E53935]" /> Select Dispute Reason *
              </label>

              <div className="flex flex-col gap-2 mt-1">
                {reasons.map((r) => {
                  const isSelected = reason === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`text-left p-3.5 rounded-2xl border text-xs font-extrabold transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-rose-50/40 border-[#E53935] text-[#E53935] shadow-xs'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <span>{r}</span>
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-[#E53935] bg-[#E53935]' : 'border-neutral-300 bg-white'
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Description Text Area */}
            <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-neutral-50 pb-2">
                <label className="text-xs font-black text-neutral-800 block">Problem Description *</label>
                <span className={`text-[10px] font-bold ${
                  description.length < 30 ? 'text-rose-500' : 'text-emerald-600'
                }`}>
                  {description.length}/30+ characters
                </span>
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Give details about what went wrong with your order. Minimum 30 characters required. (Chonde tsimikizani vutoli mwatsatanetsatane)"
                rows={5}
                className="w-full text-xs p-3.5 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-1 focus:ring-[#E53935] leading-relaxed resize-none mt-1"
                required
              />
            </div>

            {/* Step 3: Photos Uploader */}
            <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-neutral-50 pb-[7px]">
                <label className="text-xs font-black text-neutral-800 inline-flex items-center gap-1.5">
                  <Camera className="h-4.5 w-4.5 text-[#E53935]" /> Supporting Photos (Optional)
                </label>
                <span className="text-[10px] text-neutral-400 font-bold">{photos.length}/5 photos</span>
              </div>

              <p className="text-[10px] text-neutral-450 leading-relaxed font-semibold">
                Attach pictures showing defects or damages to expedite refund reviews.
              </p>

              {/* Photo Pick File Element */}
              {photos.length < 5 && (
                <div className="relative mt-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handlePhotoPick}
                    className="absolute inset-0 opacity-0 cursor-pointer h-full w-full"
                  />
                  <div className="w-full border-2 border-dashed border-neutral-200 rounded-2xl p-4 text-center hover:bg-neutral-50 transition-all cursor-pointer flex flex-col items-center justify-center gap-1">
                    <Camera className="h-5 w-5 text-neutral-400" />
                    <span className="text-xs font-extrabold text-[#E53935]">Browse Images</span>
                    <span className="text-[10px] text-neutral-400">Up to 5MB max size per JPG/PNG image</span>
                  </div>
                </div>
              )}

              {/* Photos Previews list */}
              {photos.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {photos.map((p) => (
                    <div key={p.id} className="relative h-14 w-14 rounded-xl border border-neutral-200 overflow-hidden bg-slate-100 group">
                      <img src={p.preview} alt="preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(p.id, p.preview)}
                        className="absolute top-0.5 right-0.5 bg-neutral-900/80 hover:bg-red-600 text-white rounded-full p-0.5 transition-all text-center"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 4: Resolution Selector */}
            <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm flex flex-col gap-3">
              <label className="text-xs font-black text-neutral-800 block border-b border-neutral-50 pb-2">
                Preferred Settlement Resolution *
              </label>

              <div className="flex flex-col gap-2.5 mt-1">
                {resolutions.map((resOpt) => {
                  const isSelected = resolution === resOpt.value;
                  const IconComp = resOpt.icon;
                  return (
                    <button
                      key={resOpt.value}
                      type="button"
                      onClick={() => setResolution(resOpt.value)}
                      className={`text-left p-4 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#E53935]/5 border-[#E53935] text-[#E53935] shadow-xs'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <IconComp className={`h-4.5 w-4.5 ${isSelected ? 'text-[#E53935]' : 'text-neutral-400'}`} />
                        <span>{resOpt.label}</span>
                      </div>
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-[#E53935] bg-[#E53935]' : 'border-neutral-300 bg-white'
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trigger Alert error */}
            {errorText && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-3xl flex items-center gap-3 text-xs leading-relaxed">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
                <p>{errorText}</p>
              </div>
            )}

            {/* Red button submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#E53935] hover:bg-[#D32F2F] font-sans font-black text-white py-3.5 rounded-full text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Uploading attachments... {photos.length > 0 ? 'Wait' : ''}</span>
                </>
              ) : (
                <>
                  <FileCheck2 className="h-4 w-4" /> Submit Dispute File
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
