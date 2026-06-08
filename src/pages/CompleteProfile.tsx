import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { 
  ShoppingBag, Store, MapPin, User, ArrowRight, ShieldCheck, Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MALAWI_CITIES = [
  'Lilongwe',
  'Blantyre',
  'Mzuzu',
  'Zomba',
  'Kasungu',
  'Mangochi',
  'Dedza',
  'Salima',
  'Karonga',
  'Other'
];

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user, saveUserProfile, loading } = useAuthStore();
  
  const [name, setName] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [city, setCity] = useState('Lilongwe');
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Handle submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setToastMsg('');

    if (!name.trim()) {
      setErrorMsg('Chonde lemberani dzina lanu lonse / Please specify your full name.');
      return;
    }

    if (!city) {
      setErrorMsg('Chonde sankhani dera lanu / Please select your town or city.');
      return;
    }

    const result = await saveUserProfile({ name: name.trim(), role, city });
    if (result.success) {
      setToastMsg('✓ Mbiri yanu yasungidwa! Profile configured.');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } else {
      setErrorMsg(result.error || 'Failed to save profile. Please try again.');
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 animate-[fadeIn_0.3s_ease] max-w-md mx-auto min-h-[80vh] justify-center text-[#212121]">
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-neutral-800 text-white font-extrabold text-[11px] uppercase tracking-wider py-3 px-6 rounded-full shadow-2xl flex items-center gap-2 whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 bg-red-50 text-[#E53935] rounded-3xl flex items-center justify-center text-3xl shadow-xs border border-red-100 font-bold mb-4">
          👋
        </div>
        <h1 className="font-display font-black text-2xl text-neutral-900 tracking-tight">Complete your profile</h1>
        <p className="text-[10px] uppercase font-black tracking-widest text-[#E53935] mt-1">Lembetsani mbiri yanu</p>
      </div>

      <div className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-sm flex flex-col gap-5">
        
        {errorMsg && (
          <div className="bg-red-50 border border-red-150 p-3.5 rounded-2xl text-[11px] font-bold text-red-650 text-center uppercase tracking-wide">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Name Field */}
          <div>
            <label htmlFor="fullname-input" className="block text-[10px] font-black text-neutral-450 uppercase mb-1.5 tracking-wider">
              Full Name / Dzina Lanu Lonse
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                <User className="h-4 w-4" />
              </span>
              <input
                id="fullname-input"
                type="text"
                placeholder="E.g. Chisomo Phiri"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-neutral-200 py-3 pl-10 pr-3 bg-neutral-50 focus:bg-white text-neutral-900 focus:ring-1 focus:ring-[#E53935] focus:outline-none placeholder-neutral-400 transition"
              />
            </div>
          </div>

          {/* Role selector field */}
          <div>
            <label className="block text-[10px] font-black text-neutral-450 uppercase mb-2 tracking-wider">
              What do you want to do on ShopEasy?
            </label>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Buyer role */}
              <button
                id="role-buyer-btn"
                type="button"
                onClick={() => setRole('buyer')}
                className={`p-4 rounded-2xl border text-left transition flex flex-col gap-2 relative ${
                  role === 'buyer' 
                    ? 'bg-red-50/50 border-[#E53935] hover:bg-red-50' 
                    : 'bg-neutral-50 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-sm ${
                  role === 'buyer' ? 'bg-[#E53935] text-white' : 'bg-neutral-250 text-neutral-500'
                }`}>
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-[11px] text-neutral-900 uppercase">I want to Buy</h4>
                  <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-tight mt-0.5">Sankhani ndigula</p>
                </div>
                {role === 'buyer' && (
                  <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-[#E53935]" />
                )}
              </button>

              {/* Seller role */}
              <button
                id="role-seller-btn"
                type="button"
                onClick={() => setRole('seller')}
                className={`p-4 rounded-2xl border text-left transition flex flex-col gap-2 relative ${
                  role === 'seller' 
                    ? 'bg-red-50/50 border-[#E53935] hover:bg-red-50' 
                    : 'bg-neutral-50 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-sm ${
                  role === 'seller' ? 'bg-[#E53935] text-white' : 'bg-neutral-250 text-neutral-500'
                }`}>
                  <Store className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-[11px] text-neutral-900 uppercase">I want to Sell</h4>
                  <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-tight mt-0.5">Sankhani ndigulitsa</p>
                </div>
                {role === 'seller' && (
                  <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-[#E53935]" />
                )}
              </button>
            </div>
          </div>

          {/* Location field */}
          <div>
            <label htmlFor="city-select" className="block text-[10px] font-black text-neutral-450 uppercase mb-1.5 tracking-wider">
              Town/City / Mzinda Wanu
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400 pointer-events-none">
                <MapPin className="h-4 w-4" />
              </span>
              <select
                id="city-select"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-neutral-200 py-3 pl-10 pr-8 bg-neutral-50 text-neutral-900 focus:bg-white focus:ring-1 focus:ring-[#E53935] focus:outline-none appearance-none transition"
              >
                {MALAWI_CITIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-neutral-400 text-[10px]">
                ▼
              </span>
            </div>
          </div>

          {/* Submit Action */}
          <button
            id="letsgo-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 rounded-full bg-[#E53935] hover:bg-red-700 text-white text-xs font-black tracking-wide uppercase transition hover:shadow-md disabled:bg-neutral-300 flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Sacing profile...' : "Let's Go! / Tiyeni"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
