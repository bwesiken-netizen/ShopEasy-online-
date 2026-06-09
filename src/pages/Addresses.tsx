import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { useI18nStore } from '../i18n';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  writeBatch, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { ArrowLeft, Plus, MapPin, Trash2, Check, Home, Landmark, User, Phone, CheckSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Address {
  id: string;
  fullName: string;
  phone: string;
  city: string;
  area: string;
  landmark?: string;
  isDefault: boolean;
  createdAt?: string;
}

export default function Addresses() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t } = useI18nStore();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Lilongwe');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [formError, setFormError] = useState('');

  // Toast
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const fetchAddresses = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const addrColRef = collection(db, 'users', user.uid, 'addresses');
      const q = query(addrColRef, orderBy('isDefault', 'desc'));
      const snap = await getDocs(q);
      const items: Address[] = [];
      snap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as Address);
      });
      setAddresses(items);
    } catch (err) {
      console.error("Failed to load addresses from Firestore: ", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, [user?.uid]);

  const openAddSheet = () => {
    setSelectedAddress(null);
    setFullName(user?.name || '');
    setPhone(user?.phone || '');
    setCity(user?.city || user?.location || 'Lilongwe');
    setArea('');
    setLandmark('');
    setIsDefault(addresses.length === 0); // Default if there are no addresses
    setFormError('');
    setShowBottomSheet(true);
  };

  const openEditSheet = (addr: Address) => {
    setSelectedAddress(addr);
    setFullName(addr.fullName);
    setPhone(addr.phone);
    setCity(addr.city);
    setArea(addr.area);
    setLandmark(addr.landmark || '');
    setIsDefault(addr.isDefault);
    setFormError('');
    setShowBottomSheet(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.uid) return;

    try {
      const docRef = doc(db, 'users', user.uid, 'addresses', id);
      await deleteDoc(docRef);
      
      // Update local state
      setAddresses((prev) => prev.filter((a) => a.id !== id));

      setToastMsg(t('addressDeleted'));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error("Failed to delete address: ", err);
    }
  };

  const handleSetDefault = async (addrId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user?.uid) return;

    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      // Update all to false, target to true
      addresses.forEach((addr) => {
        const docRef = doc(db, 'users', user.uid!, 'addresses', addr.id);
        batch.update(docRef, { isDefault: addr.id === addrId });
      });

      await batch.commit();

      // Refresh list
      await fetchAddresses();

      setToastMsg("Default address updated!");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error("Failed to set default address: ", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !area.trim()) {
      setFormError("All fields with asterisk (*) are required.");
      return;
    }

    if (!user?.uid) return;

    setSavingAddress(true);
    setFormError('');

    try {
      const batch = writeBatch(db);
      const addrColRef = collection(db, 'users', user.uid, 'addresses');

      let targetId = '';
      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        city,
        area: area.trim(),
        landmark: landmark.trim(),
        isDefault,
        updatedAt: new Date().toISOString()
      };

      if (selectedAddress) {
        // Edit Mode
        targetId = selectedAddress.id;
        const mainDocRef = doc(db, 'users', user.uid, 'addresses', targetId);
        batch.update(mainDocRef, payload);
      } else {
        // Create Mode
        const newDocRef = doc(collection(db, 'users', user.uid, 'addresses'));
        targetId = newDocRef.id;
        batch.set(newDocRef, {
          ...payload,
          id: targetId,
          createdAt: new Date().toISOString()
        });
      }

      // If isDefault is true, all other addresses must be false
      if (isDefault) {
        addresses.forEach((addr) => {
          if (addr.id !== targetId) {
            const otherDocRef = doc(db, 'users', user.uid!, 'addresses', addr.id);
            batch.update(otherDocRef, { isDefault: false });
          }
        });
      }

      await batch.commit();

      // Success
      setToastMsg(t('addressSaved'));
      setShowBottomSheet(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Refresh
      await fetchAddresses();
    } catch (err: any) {
      console.error("Failed to save address: ", err);
      setFormError("Could not save address. Try again.");
    } finally {
      setSavingAddress(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 animate-[fadeIn_0.3s_ease]" id="addresses-view">
      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-4 py-3.5 flex items-center justify-between" id="addresses-header">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/settings')}
            className="p-1 rounded-full text-neutral-500 hover:bg-neutral-100 active:bg-neutral-200 transition-all"
            id="back-to-settings-btn"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display font-black text-base text-neutral-900 uppercase tracking-tight" id="addresses-title">
            {t('deliveryAddresses')}
          </h1>
        </div>

        <button
          onClick={openAddSheet}
          className="text-xs font-black uppercase text-[#E53935] hover:text-[#c62828] select-none flex items-center gap-1 bg-red-50 hover:bg-red-100/60 px-3 py-1.5 rounded-full transition-all"
          id="add-address-trigger"
        >
          <Plus className="h-4 w-4" />
          <span>{t('save')}</span>
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 p-4" id="addresses-content-area">
        {loading && addresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" id="address-loading">
            <Loader2 className="h-8 w-8 animate-spin text-[#E53935]" />
          </div>
        ) : addresses.length === 0 ? (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm" id="addresses-empty-state">
            <span className="text-5xl mb-4 text-neutral-300">📍</span>
            <h2 className="font-display font-black text-base text-neutral-800 leading-tight">
              {t('noSavedAddresses')}
            </h2>
            <p className="text-xs text-neutral-450 mt-1 font-semibold leading-normal max-w-[240px]">
              Provide a verified delivery center so town dispatchers can deliver your farm produce smoothly.
            </p>
            <button
              onClick={openAddSheet}
              className="mt-6 bg-[#E53935] hover:bg-[#c62828] text-white text-xs font-black uppercase px-6 py-3 rounded-full shadow-md hover:shadow-lg transition-all"
              id="empty-add-address-btn"
            >
              {t('addAddress')}
            </button>
          </div>
        ) : (
          /* ADDRESS LIST */
          <div className="space-y-3" id="addresses-list-holder">
            <div className="flex justify-between items-center px-1 mb-1">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                {addresses.length} SAVED PLACES
              </span>
              <span className="text-[9px] font-black text-neutral-450 uppercase font-mono bg-neutral-100 px-2.5 py-1 rounded-md">
                Tap to edit / update
              </span>
            </div>

            {addresses.map((addr) => (
              <div
                key={addr.id}
                onClick={() => openEditSheet(addr)}
                className={`relative bg-white rounded-3xl p-4.5 border transition-all cursor-pointer shadow-sm group hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-2.5 ${
                  addr.isDefault 
                    ? 'border-[#E53935]/35 bg-red-50/5' 
                    : 'border-neutral-100 hover:border-neutral-200'
                }`}
                id={`address-card-${addr.id}`}
              >
                {/* CARD TITLE & ACTIONS */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-neutral-900 group-hover:text-[#E53935] transition-colors">
                      {addr.fullName}
                    </span>
                    {addr.isDefault && (
                      <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full tracking-wide">
                        {t('defaultAddress')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleDelete(addr.id, e)}
                      className="p-1.5 rounded-full text-neutral-400 hover:text-red-500 hover:bg-neutral-50 active:bg-neutral-100 transition-all"
                      title="Delete Address"
                      id={`delete-address-btn-${addr.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* DETAILS ROW */}
                <div className="text-[11px] text-neutral-600 font-semibold space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span className="font-mono text-[10px]">{addr.phone}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#E53935] shrink-0 mt-0.5" />
                    <span>{addr.area}, {addr.city}</span>
                  </div>
                  {addr.landmark && (
                    <div className="flex items-center gap-1.5 text-neutral-450 text-[10px]">
                      <Landmark className="h-3.5 w-3.5 text-neutral-450 shrink-0" />
                      <span>{addr.landmark}</span>
                    </div>
                  )}
                </div>

                {/* SET DEFAULT ACTION BUTTON */}
                {!addr.isDefault && (
                  <button
                    onClick={(e) => handleSetDefault(addr.id, e)}
                    className="mt-1 self-start text-[9px] font-black uppercase text-neutral-500 hover:text-[#E53935] border border-neutral-200 hover:border-[#E53935]/40 px-3 py-1.5 rounded-full bg-neutral-50 transition-all select-none"
                    id={`set-default-btn-${addr.id}`}
                  >
                    Set as Default
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM SHEET MODAL (Framer Motion) */}
      <AnimatePresence>
        {showBottomSheet && (
          <div className="fixed inset-0 z-50 overflow-hidden" id="addresses-bottom-sheet-overlay">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBottomSheet(false)}
              className="absolute inset-0 bg-black"
            />

            {/* Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute bottom-0 inset-x-0 bg-white rounded-t-[32px] border-t border-neutral-100 p-5 shadow-2xl flex flex-col max-h-[90vh]"
              id="addresses-bottom-sheet-content"
            >
              {/* Drag bar and close */}
              <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-4" />

              <h2 className="font-display font-black text-base text-neutral-950 uppercase tracking-tight mb-4" id="sheet-title">
                {selectedAddress ? 'Edit Address' : 'Add New Address'}
              </h2>

              <form onSubmit={handleSaveAddress} className="space-y-3.5 overflow-y-auto flex-1 pb-6 pr-1">
                {formError && (
                  <div className="bg-orange-50 border border-orange-100 p-3 rounded-2xl text-[11px] text-orange-800 font-bold" id="form-error">
                    {formError}
                  </div>
                )}

                {/* FULL NAME */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-450">
                    Recipient Full Name *
                  </label>
                  <div className="flex items-center gap-2 bg-neutral-55 bg-neutral-50 p-3 rounded-2xl border border-neutral-150 focus-within:border-[#E53935] focus-within:bg-white transition-all">
                    <User className="h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="E.g. Chimwemwe Phiri"
                      className="bg-transparent text-xs text-neutral-900 focus:outline-none flex-1 font-semibold"
                    />
                  </div>
                </div>

                {/* PHONE */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-450">
                    Phone Wallet Number (Airtel/TNM) *
                  </label>
                  <div className="flex items-center gap-2 bg-neutral-50 p-3 rounded-2xl border border-neutral-150 focus-within:border-[#E53935] focus-within:bg-white transition-all">
                    <Phone className="h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+265 999 ..."
                      className="bg-transparent text-xs text-neutral-900 focus:outline-none flex-1 font-mono font-black"
                    />
                  </div>
                </div>

                {/* CITY & AREA GRIDS */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-neutral-450">
                      City *
                    </label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-150 rounded-2xl p-3 text-xs font-bold text-neutral-900 focus:outline-none focus:border-[#E53935]"
                    >
                      {['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba'].map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-neutral-450">
                      Area / Neighborhood *
                    </label>
                    <input
                      type="text"
                      required
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="E.g. Area 18 / Namiwawa"
                      className="w-full bg-neutral-50 border border-neutral-150 rounded-2xl p-3 text-xs font-semibold text-neutral-905 focus:outline-none focus:border-[#E53935]"
                    />
                  </div>
                </div>

                {/* LANDMARK */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-450">
                    {t('landmark')}
                  </label>
                  <div className="flex items-center gap-2 bg-neutral-55 bg-neutral-50 p-3 rounded-2xl border border-neutral-150 focus-within:border-[#E53935] focus-within:bg-white transition-all">
                    <Landmark className="h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="E.g. Near Chipiku Store / ADMARC depot"
                      className="bg-transparent text-xs text-neutral-900 focus:outline-none flex-1 font-semibold"
                    />
                  </div>
                </div>

                {/* SET DEFAULT ADDRESS CHECKBOX */}
                <div className="pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="rounded border-neutral-350 text-[#E53935] focus:ring-[#E53935]"
                    />
                    <span className="text-xs text-neutral-600 font-bold select-none">
                      {t('setAsDefault')}
                    </span>
                  </label>
                </div>

                {/* ACTIONS */}
                <div className="pt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBottomSheet(false)}
                    className="h-11 border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-xs font-black uppercase rounded-full transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAddress}
                    className="h-11 bg-[#E53935] hover:bg-[#c62828] text-white text-xs font-black uppercase rounded-full shadow-md flex items-center justify-center gap-1.5 transition-all"
                  >
                    {savingAddress ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Save Address</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST SYSTEM */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-neutral-900/90 text-white font-semibold text-xs py-3 px-5 rounded-full shadow-lg flex items-center gap-2 z-50 animate-[slideUp_0.2s_ease-out]" id="toast-notif-addresses">
          <Check className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
