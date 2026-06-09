import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebase';
import { useAuthStore } from '../stores';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MALAWI_CITIES, CATEGORIES } from '../data/malawiProducts';
import { 
  ArrowLeft, 
  Store as StoreIcon, 
  Phone, 
  Upload, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  CreditCard, 
  Smartphone, 
  BookOpen, 
  ShieldCheck, 
  Info,
  Clock
} from 'lucide-react';

export default function SellerSetup() {
  const navigate = useNavigate();
  const { user, saveUserProfile } = useAuthStore();
  const uid = auth.currentUser?.uid || user?.uid;

  // Store status state
  const [storeStatus, setStoreStatus] = useState<'not_started' | 'pending_approval' | 'approved' | 'rejected' | null>(null);
  const [storeData, setStoreData] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form Steps
  const [step, setStep] = useState(1); // 1 to 4

  // Step 1: Store Details Fields
  const [storeName, setStoreName] = useState('');
  const [storeDesc, setStoreDesc] = useState('');
  const [storeCategory, setStoreCategory] = useState(CATEGORIES[0]?.name || 'Farm Produce');
  const [storeLogoUrl, setStoreLogoUrl] = useState('');
  const [storeLogoFile, setStoreLogoFile] = useState<File | null>(null);
  const [city, setCity] = useState(MALAWI_CITIES[0] || 'Lilongwe');

  // Step 2: Contact & Payout Fields
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [airtelMoney, setAirtelMoney] = useState('');
  const [tnmMpamba, setTnmMpamba] = useState('');

  // Step 3: ID Verification Fields
  const [idFrontUrl, setIdFrontUrl] = useState('');
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackUrl, setIdBackUrl] = useState('');
  const [idBackFile, setIdBackFile] = useState<File | null>(null);

  // Terms and Agreement on step 4
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Load categories from Firestore if available
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  
  // UI States
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: string }>({});
  const [validationError, setValidationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [roleSwitching, setRoleSwitching] = useState(false);

  // Check unique store name
  const [checkingName, setCheckingName] = useState(false);
  const [nameIsUnique, setNameIsUnique] = useState<boolean | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoadingInitial(false);
      return;
    }

    // Load Categories from Firestore
    const loadCategories = async () => {
      try {
        const snap = await getDocs(collection(db, 'categories'));
        if (!snap.empty) {
          const list: string[] = [];
          snap.forEach((doc) => {
            const data = doc.data();
            if (data.name) list.push(data.name);
          });
          setDbCategories(list);
        }
      } catch (err) {
        console.warn("Could not query firestore categories, using static:", err);
      }
    };

    // Load store status
    const loadStoreStatus = async () => {
      try {
        const storeDocRef = doc(db, 'stores', uid);
        const snap = await getDoc(storeDocRef);
        if (snap.exists()) {
          const data = snap.data();
          setStoreStatus(data.status || 'not_started');
          setStoreData(data);
          
          // Pre-populate if rejected or pending to verify
          setStoreName(data.name || '');
          setStoreDesc(data.description || '');
          setStoreCategory(data.category || CATEGORIES[0]?.name || 'Farm Produce');
          setStoreLogoUrl(data.logo || '');
          setCity(data.city || MALAWI_CITIES[0] || 'Lilongwe');
          setPhone(data.phone || '');
          setWhatsapp(data.whatsapp || '');
          setAirtelMoney(data.airtelMoney || '');
          setTnmMpamba(data.tnmMpamba || '');
          setIdFrontUrl(data.idFront || '');
          setIdBackUrl(data.idBack || '');
        } else {
          setStoreStatus('not_started');
        }
      } catch (err) {
        console.error("Error loading store onboarding status:", err);
      } finally {
        setLoadingInitial(false);
      }
    };

    loadCategories();
    loadStoreStatus();
  }, [uid]);

  // Switcheng user role helper for easy sandbox/dev testing access
  const handleUpgradeToSeller = async () => {
    if (!uid) return;
    setRoleSwitching(true);
    try {
      await saveUserProfile({
        name: user?.name || 'ShopEasy Seller',
        role: 'seller',
        city: user?.city || 'Lilongwe'
      });
      // Force reload page state
      window.location.reload();
    } catch (e) {
      alert("Failed to escalate account: " + String(e));
    } finally {
      setRoleSwitching(false);
    }
  };

  // Check Name Uniqueness from Firestore
  const verifyStoreNameUniqueness = async (nameVal: string) => {
    if (!nameVal.trim()) {
      setNameIsUnique(null);
      return;
    }
    setCheckingName(true);
    try {
      const q = query(collection(db, 'stores'), where('name', '==', nameVal.trim()));
      const snap = await getDocs(q);
      
      // If store belongs to current uid, we consider it unique
      let unique = true;
      snap.forEach((doc) => {
        if (doc.id !== uid) {
          unique = false;
        }
      });
      setNameIsUnique(unique);
    } catch (e) {
      console.error("Error checking name uniqueness:", e);
      setNameIsUnique(true); // Fallback to safe true to avoid hard blocking in sandbox
    } finally {
      setCheckingName(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;

    setStoreLogoFile(file);
    // Create an object URL for instant preview
    setStoreLogoUrl(URL.createObjectURL(file));

    setUploadProgress(prev => ({ ...prev, logo: 'Uploading...' }));
    try {
      const storeLogoRef = ref(storage, `stores/${uid}/logo.jpg`);
      await uploadBytes(storeLogoRef, file);
      const url = await getDownloadURL(storeLogoRef);
      setStoreLogoUrl(url);
      setUploadProgress(prev => ({ ...prev, logo: '✓ Ready' }));
    } catch (err) {
      console.error("Logo upload error:", err);
      setUploadProgress(prev => ({ ...prev, logo: 'Error uploading' }));
    }
  };

  const handleIDFrontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;

    setIdFrontFile(file);
    setIdFrontUrl(URL.createObjectURL(file));

    setUploadProgress(prev => ({ ...prev, idFront: 'Uploading...' }));
    try {
      const refId = ref(storage, `stores/${uid}/id_front.jpg`);
      await uploadBytes(refId, file);
      const url = await getDownloadURL(refId);
      setIdFrontUrl(url);
      setUploadProgress(prev => ({ ...prev, idFront: '✓ Ready' }));
    } catch (err) {
      console.error("Id front upload error:", err);
      setUploadProgress(prev => ({ ...prev, idFront: 'Error uploading' }));
    }
  };

  const handleIDBackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;

    setIdBackFile(file);
    setIdBackUrl(URL.createObjectURL(file));

    setUploadProgress(prev => ({ ...prev, idBack: 'Uploading...' }));
    try {
      const refId = ref(storage, `stores/${uid}/id_back.jpg`);
      await uploadBytes(refId, file);
      const url = await getDownloadURL(refId);
      setIdBackUrl(url);
      setUploadProgress(prev => ({ ...prev, idBack: '✓ Ready' }));
    } catch (err) {
      console.error("Id back upload error:", err);
      setUploadProgress(prev => ({ ...prev, idBack: 'Error uploading' }));
    }
  };

  // Validate Phone Formatting (+265)
  const isValidMalawiPhone = (num: string) => {
    return /^\+265\d{8,10}$/.test(num.trim());
  };

  // Step Navigations & Validiations
  const handleNextStep = async () => {
    setValidationError('');

    if (step === 1) {
      if (!storeName.trim()) {
        setValidationError('Store Name is required');
        return;
      }
      if (nameIsUnique === false) {
        setValidationError('This Store Name is already taken. Please choose another unique name.');
        return;
      }
      if (storeDesc.trim().length < 50) {
        setValidationError(`Store Description must be at least 50 characters. Current length: ${storeDesc.trim().length}`);
        return;
      }
      if (!storeLogoUrl) {
        setValidationError('Please upload a store logo or image.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!phone.trim() || !isValidMalawiPhone(phone)) {
        setValidationError('A valid Business Phone number is required in +265XXXXXXXXX format');
        return;
      }
      if (whatsapp.trim() && !isValidMalawiPhone(whatsapp)) {
        setValidationError('If provided, Whatsapp Number must be in +265XXXXXXXXX format');
        return;
      }
      const hasAirtel = airtelMoney.trim().length > 0;
      const hasMpamba = tnmMpamba.trim().length > 0;
      if (!hasAirtel && !hasMpamba) {
        setValidationError('At least one mobile money payout number (Airtel Money or TNM Mpamba) is required');
        return;
      }
      if (hasAirtel && !isValidMalawiPhone(airtelMoney)) {
        setValidationError('Airtel Money number must be in +265XXXXXXXXX format');
        return;
      }
      if (hasMpamba && !isValidMalawiPhone(tnmMpamba)) {
        setValidationError('TNM Mpamba number must be in +265XXXXXXXXX format');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!idFrontUrl) {
        setValidationError('Please upload the front image of your ID / Passport');
        return;
      }
      if (!idBackUrl) {
        setValidationError('Please upload the back image of your ID / Passport');
        return;
      }
      setStep(4);
    }
  };

  // Final submission of stores onboarding request
  const handleSubmitApproval = async () => {
    if (!agreeTerms) {
      setValidationError('You must agree to the ShopEasy Seller Terms & Conditions');
      return;
    }

    setSubmitting(true);
    setValidationError('');
    try {
      const payload = {
        sellerId: uid,
        name: storeName.trim(),
        description: storeDesc.trim(),
        category: storeCategory,
        logo: storeLogoUrl,
        city: city,
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || phone.trim(),
        airtelMoney: airtelMoney.trim() || '',
        tnmMpamba: tnmMpamba.trim() || '',
        idFront: idFrontUrl,
        idBack: idBackUrl,
        status: 'pending_approval',
        rating: 0,
        ratingCount: 0,
        followerCount: 0,
        totalSales: 0,
        responseRate: 100,
        autoReply: false,
        autoReplyText: '',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'stores', uid!), payload);

      // Create Admin notification to process request
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        title: '🆕 Store Approval Requested 🏪',
        body: `Merchant "${storeName}" has submitted their store application in ${city} for verification.`,
        type: 'order',
        read: false,
        createdAt: new Date().toISOString()
      });

      setStoreStatus('pending_approval');
      setStoreData(payload);
    } catch (err: any) {
      console.error("Error submitting seller setup application:", err);
      setValidationError('Failed to submit application. Please verify your connection: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetApplication = async () => {
    if (window.confirm("Are you sure you want to discard this application details and reset the onboarding form?")) {
      setStoreStatus('not_started');
      setStep(1);
      setStoreName('');
      setStoreDesc('');
      setStoreLogoUrl('');
      setIdFrontUrl('');
      setIdBackUrl('');
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center" id="setup-loader">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 text-sm">Loading ShopEasy Merchant Portal status...</p>
      </div>
    );
  }

  // Guard block: only role == 'seller' or 'admin' can access setup. 
  // If buyer, show help screen with a magical inline promotion button for sandbox testers convenience.
  if (user?.role !== 'seller' && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 pb-20 flex flex-col items-center justify-center p-6 text-center" id="seller-guard">
        <div className="bg-amber-100 p-4 rounded-full text-amber-600 mb-4 animate-bounce">
          <AlertCircle className="w-14 h-14" />
        </div>
        <h2 className="text-xl font-bold text-slate-950 tracking-tight font-sans">Seller Account Role Required</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2 leading-relaxed">
          Your current ShopEasy account role is registered as a **Buyer**. Onboarding to sell products on the main catalog requires a **Seller** privileges profile.
        </p>

        {/* Dynamic developer escalation block */}
        <div className="mt-8 bg-blue-50 border border-blue-100 p-4 rounded-2xl w-full max-w-sm text-left shadow-xs">
          <h4 className="text-xs font-black text-blue-800 uppercase tracking-widest flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 animate-pulse" /> AI Studio Sandbox Mode:
          </h4>
          <p className="text-[11px] text-blue-700 mt-1 leading-normal">
            To easily experience the full multi-step Store setup workflow, images uploads, products listings and orders management, click the button below to instantly elevate your credential role to **Seller**.
          </p>
          <button
            onClick={handleUpgradeToSeller}
            disabled={roleSwitching}
            className="mt-3.5 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
          >
            {roleSwitching ? 'Upgrading Role...' : 'Elevate Account to Seller Role →'}
          </button>
        </div>

        <button 
          onClick={() => navigate('/account')} 
          className="mt-6 text-slate-500 font-bold text-xs hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Account
        </button>
      </div>
    );
  }

  // Pending Approval screen
  if (storeStatus === 'pending_approval') {
    return (
      <div className="min-h-screen bg-slate-50 pb-20 flex flex-col items-center justify-center p-6 text-center" id="status-pending-approval">
        <div className="bg-yellow-50 text-amber-500 p-4 rounded-full border border-yellow-200 shadow-xs mb-4 animate-pulse">
          <Clock className="w-16 h-16" />
        </div>
        <span className="text-[10px] bg-yellow-100 text-amber-800 px-3 py-1 font-bold rounded-full tracking-wider uppercase font-mono mb-2">
          ⏳ Application Under Review
        </span>
        <h2 className="text-xl font-bold text-slate-900 font-sans tracking-tight">Your Store is Under Review</h2>
        <p className="text-slate-500 text-xs max-w-sm mt-3 leading-relaxed">
          Thanks for choosing ShopEasy Malawi! We've received your business details and credentials. We'll verify and approve your store within 24 hours.
        </p>

        <div className="bg-white border rounded-2xl p-4.5 text-left w-full max-w-sm mt-6 divide-y divide-slate-100 text-xs text-slate-700 shadow-3xs space-y-2">
          <div className="pt-2 flex justify-between">
            <span className="text-slate-400">Store Name:</span>
            <span className="font-bold">{storeName || storeData?.name}</span>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-slate-400">Fulfillment:</span>
            <span>{city || storeData?.city} City, MW</span>
          </div>
          <div className="pt-2 flex justify-between">
            <span className="text-slate-400">Mobile Money:</span>
            <span className="font-mono">{storeData?.airtelMoney || storeData?.tnmMpamba}</span>
          </div>
        </div>

        <div className="mt-8 space-y-4 w-full max-w-sm">
          <a 
            href="mailto:support@shopeasy.mw" 
            className="block text-center text-xs text-indigo-600 font-bold hover:underline"
          >
            Contact Support if taking too long →
          </a>
          <button
            onClick={() => navigate('/account')}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-full transition shadow-xs"
          >
            Back to Dashboard Hub
          </button>
        </div>
      </div>
    );
  }

  // Rejected screen
  if (storeStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-50 pb-20 flex flex-col items-center justify-center p-6 text-center" id="status-rejected">
        <div className="bg-rose-100 text-rose-600 p-4.5 rounded-full border border-rose-200 mb-4 shadow-sm animate-pulse">
          <AlertCircle className="w-14 h-14" />
        </div>
        <span className="text-[10px] bg-rose-100 text-rose-800 px-3 py-1 font-bold rounded-full tracking-wider uppercase font-mono mb-2">
          ❌ Registration Rejected
        </span>
        <h2 className="text-xl font-bold text-slate-900 font-sans tracking-tight">Application Needs Correction</h2>
        
        {/* Rejection Reason display */}
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 w-full max-w-sm my-5 text-left text-xs">
          <h4 className="font-extrabold text-rose-900 uppercase tracking-widest flex items-center gap-1.5 mb-1">
            Rejection Reason:
          </h4>
          <p className="text-rose-700 leading-relaxed font-semibold">
            {storeData?.rejectionReason || 'The uploaded ID documents were blurry or did not match the owner profile details. Please upload clear documents.'}
          </p>
        </div>

        <div className="space-y-3.5 w-full max-w-sm">
          <button
            onClick={handleResetApplication}
            className="w-full bg-red-650 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3.5 rounded-full transition shadow-md uppercase tracking-wider"
          >
            ✏️ Resubmit Correction Application
          </button>
          
          <button
            onClick={() => navigate('/account')}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 rounded-full transition"
          >
            Cancel and Return App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20" id="seller-setup-page">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 text-white py-4.5 px-4 flex items-center justify-between sticky top-0 z-50">
        <button 
          onClick={() => navigate('/account')} 
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-white font-sans tracking-tight flex items-center gap-1.5">
          <StoreIcon className="w-5 h-5 text-red-500 animate-pulse" /> Malawi Store Onboarding
        </span>
        <div className="w-8 h-8 font-mono text-[10px] bg-slate-800 items-center justify-center rounded-full flex text-slate-400 font-bold">
          {step}/4
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-5">
        
        {/* Progress Bar */}
        <div className="bg-white rounded-2xl py-3 px-4 shadow-3xs border border-slate-100">
          <div className="flex justify-between text-center max-w-sm mx-auto select-none">
            {[
              { num: 1, label: 'Store Details' },
              { num: 2, label: 'Payouts' },
              { num: 3, label: 'Verify ID' },
              { num: 4, label: 'Review' }
            ].map((s) => {
              const isActive = step >= s.num;
              const isCurrent = step === s.num;
              return (
                <div key={s.num} className="flex-1 flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCurrent 
                      ? 'bg-red-600 text-white ring-4 ring-red-100' 
                      : isActive 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-slate-100 text-slate-400'
                  }`}>
                    {isActive && step > s.num ? '✓' : s.num}
                  </div>
                  <span className={`text-[9.5px] mt-1.5 font-bold transition-colors ${
                    isCurrent ? 'text-red-650' : isActive ? 'text-slate-800' : 'text-slate-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
          
          <div className="w-full bg-slate-100 h-1 mt-3.5 rounded-full overflow-hidden">
            <div 
              className="bg-red-550 bg-red-600 h-full transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Validation Errors Overlay */}
        {validationError && (
          <div className="bg-rose-50 border border-rose-250 p-3.5 rounded-2xl text-xs text-rose-800 font-bold flex items-center gap-2 animate-[shake_0.2s_ease-in-out]">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* STEP 1: STORE DETAILS */}
        {step === 1 && (
          <div className="bg-white rounded-2xl p-5 shadow-3xs border border-slate-150 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <BookOpen className="w-4 h-4 text-red-600" />
              <h3 className="font-bold text-slate-900 text-sm">Step 1 — Store Details</h3>
            </div>

            {/* Store Name */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Store Name *
              </label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="E.g. Karonga Grains & Beans"
                  value={storeName}
                  onChange={(e) => {
                    setStoreName(e.target.value);
                    verifyStoreNameUniqueness(e.target.value);
                  }}
                  className="w-full font-semibold px-3.5 py-3 rounded-xl border focus:border-red-500 focus:ring-2 focus:ring-red-100 focus:outline-none bg-slate-50/50 text-xs transition text-slate-900" 
                />
                
                {/* Checking indicators */}
                <div className="absolute right-3.5 top-3">
                  {checkingName && (
                    <div className="w-4.5 h-4.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  )}
                  {!checkingName && nameIsUnique === true && (
                    <span className="text-emerald-500 text-xs font-bold">✓ Unique</span>
                  )}
                  {!checkingName && nameIsUnique === false && (
                    <span className="text-rose-500 text-xs font-bold">⚠️ Taken</span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between text-[10.5px] mb-1">
                <span className="font-bold text-slate-500 uppercase tracking-wide">Store Description *</span>
                <span className={`font-mono text-[9px] ${storeDesc.length >= 50 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {storeDesc.length}/50 min chars
                </span>
              </div>
              <textarea 
                placeholder="Briefly describe what your marketplace store offers, shipping, and pickup guidelines (Minimum 50 characters required)..."
                value={storeDesc}
                onChange={(e) => setStoreDesc(e.target.value)}
                maxLength={1000}
                rows={4}
                className="w-full font-semibold px-3.5 py-3 rounded-xl border focus:border-red-500 focus:ring-2 focus:ring-red-100 focus:outline-none bg-slate-50/50 text-xs transition text-slate-900 h-28 resize-none" 
              />
            </div>

            {/* Categories */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Store Catalog Category *
              </label>
              <select
                value={storeCategory}
                onChange={(e) => setStoreCategory(e.target.value)}
                className="w-full font-semibold px-3.5 py-3.5 rounded-xl border focus:border-red-500 focus:outline-none bg-slate-50 text-xs text-slate-900"
              >
                {(dbCategories.length > 0 ? dbCategories : CATEGORIES.map(c => c.name)).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* City */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Malawi City Location *
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full font-semibold px-3.5 py-3.5 rounded-xl border focus:border-red-500 focus:outline-none bg-slate-50 pr-8 text-xs text-slate-900"
              >
                {MALAWI_CITIES.map((cName) => (
                  <option key={cName} value={cName}>{cName}</option>
                ))}
              </select>
            </div>

            {/* Logo Image Upload with Drag & Drop fallback */}
            <div className="space-y-2">
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                Store Logo Image *
              </label>
              
              <div className="flex items-center gap-4.5 bg-slate-50/50 p-4 border border-dashed rounded-2xl">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-sans shrink-0 border border-slate-200 shadow-3xs overflow-hidden ${
                  !storeLogoUrl ? 'bg-slate-250 bg-slate-100 text-slate-400' : ''
                }`}>
                  {storeLogoUrl ? (
                    <img referrerPolicy="no-referrer" src={storeLogoUrl} alt="Store Logo" className="w-full h-full object-cover" />
                  ) : (
                    '🏪'
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 block">Upload Logo</span>
                  <span className="text-[9px] text-slate-450 block font-sans">Accepts JPEG/PNG. Stores on stores/{uid}/logo.jpg path</span>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                      id="upload-logo-input" 
                      className="hidden" 
                    />
                    <label 
                      htmlFor="upload-logo-input"
                      className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg cursor-pointer transition select-none"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {uploadProgress.logo || 'Select Logo File'}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Step Action */}
            <button
              onClick={handleNextStep}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-xs py-3.5 px-4 rounded-xl transition shadow-xs flex items-center justify-center gap-2 uppercase tracking-wider mt-4"
            >
              Continue to Step 2 →
            </button>
          </div>
        )}

        {/* STEP 2: CONTACT & PAYOUTS */}
        {step === 2 && (
          <div className="bg-white rounded-2xl p-5 shadow-3xs border border-slate-150 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Phone className="w-4 h-4 text-red-600" />
              <h3 className="font-bold text-slate-900 text-sm">Step 2 — Contact & Payout Details</h3>
            </div>

            {/* Business Phone */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Business Phone Number *
              </label>
              <input 
                type="text"
                placeholder="+265XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full font-sans font-semibold px-3.5 py-3 rounded-xl border focus:border-red-500 focus:outline-none bg-slate-50/50 text-xs text-slate-900" 
              />
              <span className="text-[9px] text-slate-450 mt-1 block">Your primary business number formatted in Malawi standard internationally (e.g. +265888231201 or +265999450321)</span>
            </div>

            {/* WhatsApp Phone */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                WhatsApp Number
              </label>
              <input 
                type="text"
                placeholder="+265XXXXXXXXX"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full font-sans font-semibold px-3.5 py-3 rounded-xl border focus:border-red-500 focus:outline-none bg-slate-50/50 text-xs text-slate-900" 
              />
              <span className="text-[9px] text-slate-450 mt-1 block">Left empty, we'll default to using your primary business phone.</span>
            </div>

            {/* MOBILE MONEY EXPLAINER */}
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900 flex items-start gap-2.5">
              <Smartphone className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider block">Payout Accounts Information</span>
                <span className="text-[9.5px] text-amber-700 block mt-0.5 leading-normal">
                  Sales are held securely. Final payouts are processed and sent to your mobile money wallet. Please enter at least one verified Malawi mobile money account.
                </span>
              </div>
            </div>

            {/* Airtel Money */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                Airtel Money Phone Number
              </label>
              <input 
                type="text"
                placeholder="+265999XXXXXX"
                value={airtelMoney}
                onChange={(e) => setAirtelMoney(e.target.value)}
                className="w-full font-sans font-semibold px-3.5 py-3 rounded-xl border focus:border-red-500 focus:outline-none bg-slate-50/50 text-xs text-slate-900" 
              />
            </div>

            {/* TNM Mpamba */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                TNM Mpamba Phone Number
              </label>
              <input 
                type="text"
                placeholder="+265888XXXXXX"
                value={tnmMpamba}
                onChange={(e) => setTnmMpamba(e.target.value)}
                className="w-full font-sans font-semibold px-3.5 py-3 rounded-xl border focus:border-red-500 focus:outline-none bg-slate-50/50 text-xs text-slate-900" 
              />
            </div>

            {/* Step Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                onClick={() => setStep(1)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl transition"
              >
                ← Back
              </button>
              <button
                onClick={handleNextStep}
                className="w-full bg-red-650 bg-red-650 bg-red-650 bg-red-600 hover:bg-red-700 text-white font-black text-xs py-3 px-4 rounded-xl transition uppercase"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ID VERIFICATION */}
        {step === 3 && (
          <div className="bg-white rounded-2xl p-5 shadow-3xs border border-slate-150 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <CreditCard className="w-4 h-4 text-red-600" />
              <h3 className="font-bold text-slate-900 text-sm">Step 3 — ID Verification upload</h3>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl flex items-start gap-2 text-indigo-900">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <p className="text-[9.5px] text-indigo-700 leading-normal">
                Malawi laws require merchant authentication. Please upload a clear photo or copy of your National ID card, passport or driving license (both sides). Your documentation is decrypted securely.
              </p>
            </div>

            {/* ID FRONT */}
            <div className="space-y-2 border-b border-slate-100 pb-4">
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                Front of ID Card / Cover *
              </label>

              <div className="border border-dashed p-4 rounded-xl flex items-center gap-4.5 bg-slate-50/20">
                <div className="w-20 h-14 rounded-lg bg-slate-100 border text-slate-400 font-bold font-sans flex items-center justify-center text-sm relative overflow-hidden shrink-0">
                  {idFrontUrl ? (
                    <img referrerPolicy="no-referrer" src={idFrontUrl} alt="ID Front" className="w-full h-full object-cover" />
                  ) : (
                    'FRONT'
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <span className="text-[10px] text-slate-500 block">stores/{uid}/id_front.jpg</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleIDFrontUpload}
                    id="id-front-input" 
                    className="hidden" 
                  />
                  <label 
                    htmlFor="id-front-input"
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[9px] py-1.5 px-3 rounded-lg cursor-pointer transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadProgress.idFront || 'Upload Front'}
                  </label>
                </div>
              </div>
            </div>

            {/* ID BACK */}
            <div className="space-y-2 pb-2">
              <label className="block text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">
                Back of ID Card / Page 2 *
              </label>

              <div className="border border-dashed p-4 rounded-xl flex items-center gap-4.5 bg-slate-50/20">
                <div className="w-20 h-14 rounded-lg bg-slate-100 border text-slate-400 font-bold font-sans flex items-center justify-center text-sm relative overflow-hidden shrink-0">
                  {idBackUrl ? (
                    <img referrerPolicy="no-referrer" src={idBackUrl} alt="ID Back" className="w-full h-full object-cover" />
                  ) : (
                    'BACK'
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <span className="text-[10px] text-slate-500 block">stores/{uid}/id_back.jpg</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleIDBackUpload}
                    id="id-back-input" 
                    className="hidden" 
                  />
                  <label 
                    htmlFor="id-back-input"
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[9px] py-1.5 px-3 rounded-lg cursor-pointer transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadProgress.idBack || 'Upload Back'}
                  </label>
                </div>
              </div>
            </div>

            {/* Navigations */}
            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                onClick={() => setStep(2)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl transition"
              >
                ← Back
              </button>
              <button
                onClick={handleNextStep}
                className="w-full bg-red-650 bg-red-600 hover:bg-red-700 text-white font-black text-xs py-3 px-4 rounded-xl transition uppercase"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & SUBMIT */}
        {step === 4 && (
          <div className="bg-white rounded-2xl p-5 shadow-3xs border border-slate-150 space-y-4 animate-[fadeIn_0.2s_ease]">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-slate-900 text-sm">Step 4 — Final application Review</h3>
            </div>

            <div className="divide-y divide-slate-100 text-xs text-slate-700 space-y-3">
              
              <div className="flex items-center gap-3.5 pb-2.5 pt-1">
                <img referrerPolicy="no-referrer" src={storeLogoUrl} alt="Store Logo" className="w-12 h-12 rounded-full border bg-slate-100 object-cover" />
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">{storeName}</h4>
                  <span className="text-[10px] text-slate-400">{storeCategory} inside {city} City</span>
                </div>
              </div>

              <div className="pt-2.5">
                <span className="text-[10px] text-slate-400 font-bold block uppercase pb-1">Store details explanation:</span>
                <p className="text-slate-600 leading-relaxed font-sans mt-0.5 max-h-24 overflow-y-auto pr-1 bg-slate-50/40 p-2 rounded-lg">{storeDesc}</p>
              </div>

              <div className="pt-3 pb-1.5 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Business Phone:</span>
                  <span className="font-bold text-slate-800">{phone}</span>
                </div>
                {whatsapp && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">WhatsApp:</span>
                    <span className="font-bold text-slate-800">{whatsapp}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Airtel Money Phone:</span>
                  <span className="font-bold font-mono text-slate-800">{airtelMoney || '- Not provided -'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">TNM Mpamba Phone:</span>
                  <span className="font-bold font-mono text-slate-800">{tnmMpamba || '- Not provided -'}</span>
                </div>
              </div>

              <div className="pt-3 pb-3">
                <span className="text-[10px] text-slate-400 font-bold block uppercase pb-1.5">Verifications credentials:</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-slate-200 rounded-lg overflow-hidden h-14 bg-slate-100">
                    <img referrerPolicy="no-referrer" src={idFrontUrl} alt="ID front" className="w-full h-full object-cover" />
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden h-14 bg-slate-100">
                    <img referrerPolicy="no-referrer" src={idBackUrl} alt="ID back" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>

            </div>

            {/* Aggreement Terms Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer selection:bg-transparent">
                <input 
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4.5 h-4.5 border rounded border-slate-300 text-red-650 focus:ring-red-500 focus:ring-opacity-25 accent-red-650 cursor-pointer mt-0.5" 
                />
                <span className="text-[11px] text-slate-650 font-semibold leading-normal">
                  I agree to the <span className="text-indigo-600 underline font-bold">ShopEasy Seller Terms & Conditions</span>. I understand any suspicious or fake products uploaded will result in instant account ban and forfeiture of withdrawals.
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                onClick={() => setStep(3)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-3 px-4 rounded-xl transition"
                disabled={submitting}
              >
                ← Back
              </button>
              <button
                onClick={handleSubmitApproval}
                disabled={submitting}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-xs py-3.5 px-4 rounded-xl transition uppercase flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Setup 🚀'}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
