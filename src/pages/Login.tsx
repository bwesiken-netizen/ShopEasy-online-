import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { Phone, ArrowRight, Sparkles } from 'lucide-react';
import { RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

export default function Login() {
  const navigate = useNavigate();
  const { sendOtp, loading, user } = useAuthStore();

  const [phoneVal, setPhoneVal] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto redirect if user is already logged in with complete profile
  useEffect(() => {
    if (user && user.isProfileComplete) {
      navigate('/', { replace: true });
    } else if (user && !user.isProfileComplete) {
      navigate('/complete-profile', { replace: true });
    }
  }, [user, navigate]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const sanitized = phoneVal.replace(/[^0-9]/g, '');
    // If user enters 10 digits starting with 0, drop the leading 0 (e.g. 0999 123 456 -> 999 123 456)
    const phone9Digits = (sanitized.startsWith('0') && sanitized.length === 10) 
      ? sanitized.substring(1) 
      : sanitized;

    if (phone9Digits.length !== 9) {
      setErrorMsg('Chonde lemberani manambala 9 am’manja / Phone must be exactly 9 digits (excluding 0).');
      return;
    }

    const fullPhoneNumber = `+265${phone9Digits}`;

    // Initialize/Retrieve the Invisible recaptcha verifier
    try {
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          },
          'expired-callback': () => {
            setErrorMsg('reCAPTCHA expired. Chonde yesesani kachiwiri.');
          }
        });
      }
    } catch (err: any) {
      setErrorMsg('Failed to initialize recaptcha protector: ' + err.message);
      return;
    }

    const appVerifier = (window as any).recaptchaVerifier;

    const res = await sendOtp(fullPhoneNumber, appVerifier);
    if (res.success) {
      setSuccessMsg('✓ OTP Code sent successfully! Pitani ku chitsimikizo...');
      setTimeout(() => {
        // Pass phone context to help input state of verify-otp page
        navigate(`/verify-otp?phone=${encodeURIComponent(fullPhoneNumber)}`);
      }, 1200);
    } else {
      setErrorMsg(res.error || 'Failed to send OTP. Please check your network and phone line format.');
      // Clear recaptcha verifier to allow retry on error
      try {
        if ((window as any).recaptchaVerifier) {
          (window as any).recaptchaVerifier.clear();
          (window as any).recaptchaVerifier = null;
        }
      } catch (err) {}
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 animate-[fadeIn_0.3s_ease] max-w-md mx-auto min-h-[85vh] justify-center text-[#212121]">
      
      {/* 1. ShopEasy logo at top & Welcome page header */}
      <div className="flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 bg-gradient-to-br from-[#E53935] to-[#FFB300] rounded-3xl flex items-center justify-center text-4xl shadow-md border border-[#E53935]/10 font-bold mb-4">
          🏪
        </div>
        <h1 className="font-display font-black text-2xl text-neutral-900 tracking-tight">
          Welcome to ShopEasy 🇲🇼
        </h1>
        <p className="text-[10px] uppercase font-black tracking-widest text-[#E53935] mt-1">
          Direct local pickup marketplace
        </p>
      </div>

      {/* LOGIN/REGISTER WRAPPER CARD */}
      <div className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-sm flex flex-col gap-4">
        
        <div className="text-center pb-2 border-b border-neutral-100">
          <h2 className="font-display font-black text-xs uppercase text-neutral-500 tracking-wider">
            Phone Verification
          </h2>
          <p className="text-[10px] font-bold text-neutral-400 mt-1">
            Lekani passwords, lowani mwachangu ndi OTP yokha
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-150 p-3.5 rounded-2xl text-[11px] font-bold text-red-650 text-center uppercase tracking-wide">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-150 p-3.5 rounded-2xl text-[11px] font-bold text-emerald-850 text-center uppercase tracking-wide">
            {successMsg}
          </div>
        )}

        {/* Form elements */}
        <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
          
          <div>
            <label htmlFor="phone-number" className="block text-[10px] font-black text-neutral-450 uppercase mb-2 tracking-wider">
              Enter your Malawian phone number
            </label>
            
            <div className="flex items-stretch rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-950 overflow-hidden focus-within:ring-1 focus-within:ring-[#E53935] focus-within:bg-white transition-all">
              {/* Prefix Locked (+265) */}
              <div className="flex items-center gap-1.5 px-3.5 bg-neutral-100 border-r border-neutral-250 font-mono text-xs font-black select-none text-neutral-600">
                <span>🇲🇼</span>
                <span>+265</span>
              </div>
              
              {/* 9-digit core input */}
              <input
                id="phone-number"
                type="tel"
                placeholder="E.g. 0999 123 456"
                value={phoneVal}
                onChange={(e) => setPhoneVal(e.target.value)}
                disabled={loading}
                className="w-full text-xs font-semibold py-3 px-3 bg-transparent text-neutral-900 focus:outline-none"
              />
            </div>
            
            <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider mt-1.5 px-1">
              Format hint: 099 XXX XXX or 088 XXX XXX
            </p>
          </div>

          {/* Send OTP Actions */}
          <button
            id="send-otp-btn"
            type="submit"
            disabled={loading || !phoneVal.trim()}
            className="w-full mt-2 py-3.5 rounded-full bg-[#E53935] hover:bg-red-700 text-white text-xs font-black tracking-wide uppercase transition hover:shadow-md disabled:bg-neutral-300 flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Sending OTP... / Dikirani' : 'Send OTP'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* reCAPTCHA Placeholder element */}
        <div id="recaptcha-container" className="mx-auto"></div>

        {/* NEW HERE FOOTER */}
        <div className="text-center pt-3 border-t border-neutral-100 text-[11px] font-extrabold text-[#E53935] uppercase tracking-wide">
          New here? Register after verifying your number
        </div>

      </div>

    </div>
  );
}
