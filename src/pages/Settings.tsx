import React, { useState } from 'react';
import { useAuthStore } from '../stores';
import { Settings as SettingsIcon, Globe, Map, Sparkles, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const { user, updateLocation } = useAuthStore();
  const [lang, setLang] = useState<'en' | 'ny'>('en');

  const handleLanguageToggle = (langCode: 'en' | 'ny') => {
    setLang(langCode);
  };

  return (
    <div className="flex flex-col gap-4 p-4 animate-[fadeIn_0.3s_ease]">
      
      {/* HEADER TITLE */}
      <h2 className="font-display font-black text-base text-neutral-900 uppercase tracking-tight flex items-center gap-1.5">
        <SettingsIcon className="h-5 w-5 text-[#E53935]" />
        <span>Marketplace Settings</span>
      </h2>

      {/* 1. CHOOSE SYSTEM LANGUAGE */}
      <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm flex flex-col gap-3">
        <label className="text-xs font-black text-neutral-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
          <Globe className="h-4.5 w-4.5 text-[#FFB300]" />
          <span>Local Language Preference</span>
        </label>

        <div className="grid grid-cols-2 gap-3 mt-1">
          <button
            onClick={() => handleLanguageToggle('en')}
            className={`py-3 rounded-2xl border text-xs font-black transition-all ${
              lang === 'en'
                ? 'border-[#E53935] bg-red-50/40 text-[#E53935]'
                : 'border-neutral-200 bg-white text-neutral-600'
            }`}
          >
            English (MW)
          </button>

          <button
            onClick={() => handleLanguageToggle('ny')}
            className={`py-3 rounded-2xl border text-xs font-black transition-all ${
              lang === 'ny'
                ? 'border-[#E53935] bg-red-50/40 text-[#E53935]'
                : 'border-neutral-200 bg-white text-neutral-600'
            }`}
          >
            Chichewa (ny)
          </button>
        </div>

        <p className="text-[10px] text-neutral-450 leading-relaxed font-semibold">
          {lang === 'en' 
            ? 'We default all system text to English mixed with typical Chichewa tags like "Muli bwanji" for ease of operation.' 
            : 'Mwasankha Chichewa. Text yonse yisinthidwa hosi ya ShopEasy m\'dera lathu la Malawi.'}
        </p>
      </div>

      {/* 2. AIRTEL/TNM CARRIER SIM ALIGNMENT */}
      <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm flex flex-col gap-3">
        <h3 className="text-xs font-extrabold text-neutral-700 uppercase tracking-widest text-[10px] flex items-center gap-1.5 pb-2 border-b border-neutral-100">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
          <span>Mobile Money Verification</span>
        </h3>

        <div className="flex gap-3.5 items-start mt-1">
          <span className="text-3xl select-none font-mono">📱</span>
          <div>
            <span className="font-extrabold text-xs text-neutral-950 block">Connected SIM Line</span>
            <span className="font-mono text-xs font-black text-[#E53935] mt-0.5 block">{user?.phone || '+265999824510'}</span>
            <p className="text-[10px] text-neutral-500 font-medium leading-relaxed mt-1">
              Your Airtel Money / TNM Mpamba phone number wallet is verified and fully protected by local Paychangu API credentials.
            </p>
          </div>
        </div>
      </div>

      {/* 3. SHOPEASY MALAWI LAWS & LEGAL */}
      <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm flex flex-col gap-2.5">
        <span className="text-xs font-black text-neutral-500 uppercase tracking-wider text-[10px] block">
          Platform Invariants:
        </span>

        <div className="flex flex-col gap-2 text-[11px] text-neutral-600 font-medium leading-relaxed">
          <div className="flex gap-2 items-start">
            <span className="text-emerald-605">✓</span>
            <p><strong>100% Local:</strong> All buyer and seller accounts must operate exclusively inside the geographic borders of Malawi.</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-emerald-605">✓</span>
            <p><strong>Zero Shipping Noise:</strong> Buyers meet sellers at physical centers (Zomba, Blantyre, Lilongwe, Mzuzu) or arrange personal town dispatchers.</p>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-emerald-605">✓</span>
            <p><strong>Paychangu Security:</strong> No credit card risks. Direct local cellular escrow processed securely.</p>
          </div>
        </div>

        <div className="text-center pt-3 border-t border-neutral-100 mt-2">
          <span className="block text-[8px] font-black text-neutral-400 uppercase font-mono">ShopEasy MW Applet • Version 1.0.0</span>
        </div>
      </div>

    </div>
  );
}
